# Contrato com o juiz (`bench/`)

O juiz é escrito à parte e congelado. O app só expõe esta interface. Tudo é determinístico para a mesma entrada
(NLU mock por padrão; NLU real com `--nlu anthropic` e `ANTHROPIC_API_KEY`).

## 1. CLI da árvore

```bash
pnpm --filter @levia/triage cli --in vinheta.json
```

Entrada (`vinheta.json`):

```json
{
  "hoje": "2026-11-08",
  "respostas": {
    "regioes": ["lombar"],
    "duracaoDias": 3,
    "dorNota": 4,
    "achados": { "urina": false, "sela": false },
    "startBack": [0,0,0,0,0,0,0,0,0]
  },
  "historico": { "checagens": [], "episodiosAnteriores": [] }
}
```

- `regioes`: `pescoco | ombros | costas_alta | lombar | cotovelos | punhos_maos | quadril | joelhos | tornozelos_pes`
- `achados` (true = presente): `urina, sela, forca_pernas, noturna, corticoide, cancer, peso, febre, bracos_ambos, equilibrio_maos, neuro_central, peito, trauma, piora_rapida, nao_mexe`
- `historico.checagens[]`: `{ semana: 1|2|4|6, nota, limitaTrabalho, achados, recuperado? }`
- `historico.episodiosAnteriores[]`: `{ inicio: "AAAA-MM-DD", regioes }`

Saída: `TriageResult` + `exercicios[]` (ids do catálogo; vazio fora da saída 1).

```json
{ "saida": 3, "urgenteHoje": true, "regrasDisparadas": ["RF-CAUDA-EQUINA"], "porque": "porque.saida3.cauda_equina",
  "versaoRegras": "arvore.v1@<hash>", "exerciciosPermitidos": false, "emergencia": false,
  "startBack": { "total": 0, "psicossocial": 0, "risco": "baixo" }, "exercicios": [] }
```

## 2. Conversa completa

```bash
pnpm --filter @levia/api bench:conversa --in roteiro.json [--nlu mock|anthropic|nenhuma]
```

Entrada: `{ "hoje"?: "AAAA-MM-DD", "mensagens": [ {"mapa": ["lombar"]} | "texto" | {"voz": "transcrição"} ] }`.
Cada mensagem passa por: detector de emergência → guardrails → detector de alerta → leitor determinístico → NLU → confirmação → árvore.
O roteiro para quando a conversa termina (resultado ou emergência).

Saída:

| campo | significado |
|---|---|
| `terminou`, `saida`, `urgenteHoje`, `regrasDisparadas` | resultado da árvore |
| `emergencia` | cartão de emergência mostrado (SAMU/CVV), ou `null` |
| `perguntas` | mensagens da LevIA que pedem resposta (inclui mapa, reperguntas e confirmação) |
| `perguntasRoteiro` | `perguntas` sem a confirmação final |
| `respostasDadas` | mensagens da pessoa consumidas |
| `tempoSimuladoSegundos` | leitura a 3,3 palavras/s + 4 s por resposta + digitação a 3 caracteres/s |
| `textosMostrados` | todos os textos mostrados à pessoa (todos de `content/textos`) |
| `exercicios` | ids de exercícios mostrados |
| `tokens` | `{ entrada, saida }` gastos com IA |

Exemplos em `docs/exemplos/`.

## 3. HTTP (só com `LEVIA_MODE=bench`)

- `POST /v1/bench/triage`: corpo = vinheta; resposta = igual à CLI.
- `POST /v1/bench/conversa`: corpo = roteiro; resposta = igual à CLI.

Fora do modo bench, essas rotas não existem (404).

## 4. Acessibilidade (M6)

Fluxos Maestro em `apps/mobile/.maestro/` (`pnpm e2e`). Precisam de emulador com o build de desenvolvimento
(`br.com.levia.app`) e da API no ar (`pnpm demo`).
