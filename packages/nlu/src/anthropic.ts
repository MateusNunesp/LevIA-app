// Provedor da Anthropic. Só roda no servidor; a chave nunca vai para o app.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { NluIndisponivel, PROMPT_SISTEMA, normalizarSaida, schemaPara, type NluProvider, type PedidoNlu, type RespostaNlu, type UsoNlu } from "./base.ts";

export interface OpcoesAnthropic {
  /** LEVIA_NLU_MODEL. Padrão claude-haiku-5-5 (meta de custo M8). */
  modelo?: string;
  maxTokens?: number;
  cliente?: Anthropic;
  timeoutMs?: number;
}

export class NluAnthropic implements NluProvider {
  readonly nome: string;
  private readonly cliente: Anthropic;
  private readonly modelo: string;
  private readonly maxTokens: number;

  constructor(op: OpcoesAnthropic = {}) {
    this.modelo = op.modelo ?? process.env.LEVIA_NLU_MODEL ?? "claude-haiku-5-5";
    this.maxTokens = op.maxTokens ?? 300;
    // maxRetries 1: "em 429 ou 5xx, uma nova tentativa" (o SDK só repete 408/409/429/5xx e falha de rede).
    this.cliente = op.cliente ?? new Anthropic({ maxRetries: 1, timeout: op.timeoutMs ?? 8000 });
    this.nome = `anthropic:${this.modelo}`;
  }

  async extrair(pedido: PedidoNlu, texto: string): Promise<{ resposta: RespostaNlu; uso: UsoNlu }> {
    let msg;
    try {
      msg = await this.cliente.messages.parse({
        model: this.modelo,
        max_tokens: this.maxTokens,
        // Sem raciocínio estendido: tarefa curta de extração, e max_tokens pequeno (M8).
        // Haiku 5.5 aceita "disabled" com esforço "high" ou menor. Sem temperature (não suportado).
        thinking: { type: "disabled" },
        output_config: { effort: "low", format: zodOutputFormat(schemaPara(pedido)) },
        // Prefixo fixo primeiro (prompt caching); prefixos curtos podem não entrar no cache.
        system: [{ type: "text", text: PROMPT_SISTEMA, cache_control: { type: "ephemeral" } }],
        messages: [
          {
            role: "user",
            content: `Pergunta: ${pedido.perguntaId} (tipo ${pedido.tipo}; opções: ${pedido.opcoes.join(", ") || "livre"})\n<resposta_da_pessoa>\n${texto.slice(0, 600)}\n</resposta_da_pessoa>`,
          },
        ],
      });
    } catch (e) {
      if (e instanceof Anthropic.RateLimitError || e instanceof Anthropic.InternalServerError || e instanceof Anthropic.APIConnectionError) {
        throw new NluIndisponivel("ia_indisponivel");
      }
      if (e instanceof Anthropic.APIError) throw new NluIndisponivel(`ia_erro_${e.status ?? "x"}`);
      throw new NluIndisponivel("ia_erro");
    }
    const uso: UsoNlu = {
      tokensEntrada: (msg.usage.input_tokens ?? 0) + (msg.usage.cache_read_input_tokens ?? 0) + (msg.usage.cache_creation_input_tokens ?? 0),
      tokensSaida: msg.usage.output_tokens ?? 0,
      cacheHit: (msg.usage.cache_read_input_tokens ?? 0) > 0,
      cacheAplicacao: false,
    };
    // Sempre checar stop_reason antes de ler o conteúdo (inclusive recusa).
    if (msg.stop_reason !== "end_turn" || !msg.parsed_output) {
      return { resposta: { valor: null, confianca: "baixa", precisa_confirmar: true, mencoes_alerta: [] }, uso };
    }
    return { resposta: normalizarSaida(pedido, msg.parsed_output), uso };
  }
}
