#!/usr/bin/env python3
"""Monta o vídeo promocional da LevIA (1920x1080, 30 fps, H.264) a partir das cenas em gravacao/.

Não é código do app. Usa PIL para fundo, moldura do celular, logo e textos (fonte Atkinson Hyperlegible,
a mesma do app) e ffmpeg para cortar, acelerar, dar zoom, sobrepor e fazer as transições.

uso: python3 promo-video/montar.py            (tudo: cenas, vídeo final, GIF, thumbnail, narração)
     python3 promo-video/montar.py s05        (só refaz a cena s05 e o vídeo final)
"""
import json
import os
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

RAIZ = os.path.dirname(os.path.abspath(__file__))
GRAV = os.path.join(RAIZ, "gravacao")
TMP = os.path.join(GRAV, "montagem")
OUT = os.path.join(RAIZ, "output")
FONTES = os.path.join(RAIZ, "..", "node_modules", "@expo-google-fonts", "atkinson-hyperlegible")
NEGRITO = os.path.join(FONTES, "700Bold", "AtkinsonHyperlegible_700Bold.ttf")
REGULAR = os.path.join(FONTES, "400Regular", "AtkinsonHyperlegible_400Regular.ttf")

W, H, FPS = 1920, 1080, 30
XFADE = 0.45  # duração de cada transição

# Cores do tema da LevIA (packages/ui/src/tokens.ts)
FUNDO = "#fbfaf7"
PRIMARIA = "#1f6f5c"
PROFUNDA = "#12443a"
SUAVE = "#d5e7e0"
BALAO = "#dcefe8"

# Celular na tela: área da tela (proporção 1080x2340) e moldura
TELA_W, TELA_H = 444, 962
TELA_X, TELA_Y = 1250, 59
BORDA = 14

# ---------- cenas: (id, arquivo, início, fim, duração final, texto, zoom final, centro y do zoom) ----------
# Um mesmo texto pode cobrir dois trechos (cena s07 = c07 acelerada + começo de c08).
CENAS = [
    ("s01", [("c01-inicio", 0.6, 4.8)], 3.4, "Tudo começa num toque", 1.00, 0.30),
    ("s02", [("c02-mapa", 1.8, 11.6)], 5.8, "Toque onde dói", 1.10, 0.42),
    ("s03", [("c03-conversa", 3.0, 119.0)], 8.0, "Perguntas curtas.\nAlertas sempre.", 1.06, 0.30),
    ("s04", [("c04-resultado", 7.0, 16.2)], 6.2, "Orientação clara\ne explicada", 1.10, 0.30),
    ("s05", [("c05-exercicios", 4.2, 16.0)], 6.0, "Exercício com vídeo\ne dose certa", 1.06, 0.38),
    ("s06", [("c06-ritmo", 4.2, 16.3)], 5.6, "Constância em equipe,\nsem expor ninguém", 1.00, 0.50),
    ("s07", [("c07-piora", 1.0, 55.4), ("c08-voz", 0.3, 3.0)], 8.0, "Sinal de alerta?\nVá hoje.", 1.08, 0.22),
    ("s08", [("c08-voz", 3.6, 10.4)], 5.0, "Fale ou escreva.\nVocê escolhe.", 1.00, 0.50),
    ("s09", [("c09-rh", 4.2, 16.6)], 7.0, "O RH vê só\nnúmeros do time", 1.00, 0.50),
]
INTRO, OUTRO = 4.0, 5.0
# divisão do tempo da s07 entre os dois trechos
S07_PARTES = [5.4, 2.6]

NARRACAO = {
    "intro": "Dor no corpo atrapalha o trabalho. E nem sempre dá para saber o que fazer.",
    "s01": "Com a LevIA, tudo começa num toque.",
    "s02": "Você mostra onde dói, direto no desenho do corpo.",
    "s03": "A LevIA faz perguntas curtas, por texto ou voz, e sempre confere os sinais de alerta.",
    "s04": "No fim, uma orientação clara, com o porquê explicado em palavras simples.",
    "s05": "Se dá para cuidar em casa, você recebe exercícios com vídeo e a dose certa.",
    "s06": "No Ritmo, a equipe se motiva junta, sem ninguém ver os pontos de ninguém.",
    "s07": "Se a dor piorar e aparecer um sinal de alerta, a LevIA é direta: vá hoje a um pronto atendimento.",
    "s08": "Prefere falar? A LevIA lê e escuta você.",
    "s09": "E o RH vê só números do time. Grupos pequenos ficam escondidos.",
    "outro": "LevIA. Cuidar da dor, sem vigiar ninguém. Leve a LevIA para a sua empresa.",
}


def ff(*args):
    cmd = ["ffmpeg", "-v", "error", "-y", *args]
    r = subprocess.run(cmd)
    if r.returncode != 0:
        raise SystemExit("ffmpeg falhou: " + " ".join(cmd))


def fonte(arq, tam):
    return ImageFont.truetype(arq, tam)


# ---------- imagens fixas ----------

def fundo_img():
    """Fundo petróleo profundo com um brilho suave atrás do celular."""
    im = Image.new("RGB", (W, H), PROFUNDA)
    brilho = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(brilho)
    cx, cy = TELA_X + TELA_W // 2, H // 2
    d.ellipse((cx - 520, cy - 520, cx + 520, cy + 520), fill=120)
    brilho = brilho.filter(ImageFilter.GaussianBlur(180))
    im = Image.composite(Image.new("RGB", (W, H), PRIMARIA), im, brilho)
    return im


def logo(draw, x, y, tam, cor_texto=FUNDO, cor_circulo=PRIMARIA):
    """Ícone de pulso num círculo (o mesmo do topo da conversa) + nome LevIA."""
    r = tam // 2
    draw.ellipse((x, y, x + tam, y + tam), fill=cor_circulo)
    s = tam / 28
    pts = [(4, 16), (9, 16), (11, 10), (15, 20), (17, 16), (24, 16)]
    draw.line([(x + px * s, y + py * s) for px, py in pts], fill=FUNDO, width=max(3, int(2.6 * s)), joint="curve")
    f = fonte(NEGRITO, int(tam * 0.78))
    draw.text((x + tam + int(tam * 0.32), y + r), "LevIA", font=f, fill=cor_texto, anchor="lm")


def moldura_img():
    """Moldura do celular com a área da tela transparente e cantos arredondados."""
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    # sombra
    sombra = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ds = ImageDraw.Draw(sombra)
    x0, y0 = TELA_X - BORDA, TELA_Y - BORDA
    x1, y1 = TELA_X + TELA_W + BORDA, TELA_Y + TELA_H + BORDA
    ds.rounded_rectangle((x0 + 10, y0 + 24, x1 + 10, y1 + 24), radius=66, fill=(0, 0, 0, 110))
    sombra = sombra.filter(ImageFilter.GaussianBlur(28))
    im.alpha_composite(sombra)
    corpo = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(corpo)
    d.rounded_rectangle((x0, y0, x1, y1), radius=66, fill="#0c1a16")
    d.rounded_rectangle((x0 + 3, y0 + 3, x1 - 3, y1 - 3), radius=63, outline="#2a4a40", width=2)
    # buraco da tela (transparente), com cantos arredondados
    furo = Image.new("L", (W, H), 0)
    ImageDraw.Draw(furo).rounded_rectangle((TELA_X, TELA_Y, TELA_X + TELA_W, TELA_Y + TELA_H), radius=50, fill=255)
    corpo.putalpha(Image.composite(Image.new("L", (W, H), 0), corpo.getchannel("A"), furo))
    im.alpha_composite(corpo)
    # a sombra não pode escurecer a tela: o furo fica 100% transparente na imagem final
    im.putalpha(Image.composite(Image.new("L", (W, H), 0), im.getchannel("A"), furo))
    return im


def texto_img(texto):
    """Texto de destaque à esquerda, em duas linhas no máximo."""
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    logo(d, 150, 92, 58)
    f = fonte(NEGRITO, 84)
    linhas = texto.split("\n")
    alt = 104
    y = H // 2 - (len(linhas) * alt) // 2 - 10
    for i, l in enumerate(linhas):
        d.text((150, y + i * alt), l, font=f, fill=FUNDO)
    # traço de acento abaixo do texto
    d.rounded_rectangle((150, y + len(linhas) * alt + 26, 150 + 96, y + len(linhas) * alt + 34), radius=4, fill="#5fbfa4")
    return im


def intro_img():
    im = fundo_img().convert("RGBA")
    d = ImageDraw.Draw(im)
    logo(d, W // 2 - 300, H // 2 - 150, 150)
    f = fonte(NEGRITO, 64)
    d.text((W // 2, H // 2 + 110), "Dor no corpo? Cuide com segurança.", font=f, fill=FUNDO, anchor="mm")
    return im


def outro_img():
    im = fundo_img().convert("RGBA")
    d = ImageDraw.Draw(im)
    logo(d, W // 2 - 300, H // 2 - 220, 150)
    d.text((W // 2, H // 2 + 50), "Cuidar da dor, sem vigiar ninguém.", font=fonte(NEGRITO, 64), fill=FUNDO, anchor="mm")
    # chamada para ação numa pílula
    f = fonte(NEGRITO, 44)
    txt = "Leve a LevIA para a sua empresa"
    tw = d.textlength(txt, font=f)
    x0, y0 = W // 2 - tw / 2 - 48, H // 2 + 150
    d.rounded_rectangle((x0, y0, x0 + tw + 96, y0 + 92), radius=46, fill=SUAVE)
    d.text((W // 2, y0 + 46), txt, font=f, fill=PROFUNDA, anchor="mm")
    return im


# ---------- cenas ----------

def tela_da_cena(sid, trechos, dur, zoom, cy):
    """Corta, acelera e dá zoom na gravação do celular. Saída: TELA_W x TELA_H, 30 fps."""
    partes = S07_PARTES if sid == "s07" else [dur]
    arquivos = []
    for k, ((arq, ini, fim), dparte) in enumerate(zip(trechos, partes)):
        vel = (fim - ini) / dparte
        n = int(round(dparte * FPS))
        # zoom suave (ease-in-out) só no último trecho da cena
        z = f"1+({zoom}-1)*(1-cos(PI*min(on/{n},1)))/2" if (zoom > 1 and k == len(trechos) - 1) else "1"
        vf = (
            f"trim={ini}:{fim},setpts=(PTS-STARTPTS)/{vel},fps={FPS},"
            f"scale={TELA_W * 2}:{TELA_H * 2}:flags=lanczos,"
            f"zoompan=z='{z}':x='(iw-iw/zoom)/2':y='max(0,min(ih-ih/zoom,{cy}*ih-ih/zoom/2))':d=1:s={TELA_W}x{TELA_H}:fps={FPS},"
            f"trim=end_frame={n},setsar=1"
        )
        saida = os.path.join(TMP, f"{sid}-tela{k}.mp4")
        ff("-i", os.path.join(GRAV, f"{arq}.mp4"), "-vf", vf, "-an", "-c:v", "libx264", "-crf", "14", "-preset", "fast", "-pix_fmt", "yuv420p", saida)
        arquivos.append(saida)
    if len(arquivos) == 1:
        return arquivos[0]
    lista = os.path.join(TMP, f"{sid}-lista.txt")
    with open(lista, "w") as f:
        for a in arquivos:
            f.write(f"file '{a}'\n")
    saida = os.path.join(TMP, f"{sid}-tela.mp4")
    ff("-f", "concat", "-safe", "0", "-i", lista, "-c", "copy", saida)
    return saida


def montar_cena(sid, trechos, dur, texto, zoom, cy):
    tela = tela_da_cena(sid, trechos, dur, zoom, cy)
    txt = os.path.join(TMP, f"{sid}-texto.png")
    texto_img(texto).save(txt)
    saida = os.path.join(TMP, f"{sid}.mp4")
    # texto entra com fade e sobe 24 px nos primeiros 0,5 s (depois da transição)
    filtro = (
        f"[0:v]setsar=1[bg];"
        f"[1:v]setpts=PTS-STARTPTS[tela];"
        f"[tela]format=yuva420p,geq=lum='lum(X,Y)':cb='cb(X,Y)':cr='cr(X,Y)':a='255*lte(hypot(max(0,abs(X-{TELA_W}/2)-({TELA_W}/2-50)),max(0,abs(Y-{TELA_H}/2)-({TELA_H}/2-50))),50)'[telar];"
        f"[bg][telar]overlay={TELA_X}:{TELA_Y}[a];"
        f"[a][2:v]overlay=0:0[b];"
        f"[3:v]format=rgba,fade=in:st=0.25:d=0.5:alpha=1[t];"
        f"[b][t]overlay=0:'24*max(0,1-(t-0.25)/0.5)'[v]"
    )
    ff(
        "-loop", "1", "-t", str(dur), "-i", os.path.join(TMP, "fundo.png"),
        "-i", tela,
        "-loop", "1", "-t", str(dur), "-i", os.path.join(TMP, "moldura.png"),
        "-loop", "1", "-t", str(dur), "-i", txt,
        "-filter_complex", filtro, "-map", "[v]", "-r", str(FPS), "-t", str(dur),
        "-c:v", "libx264", "-crf", "16", "-preset", "medium", "-pix_fmt", "yuv420p", saida,
    )
    return saida


def montar_quadro(nome, img, dur, zoom_fim=1.04):
    """Abertura e encerramento: imagem com fade e um zoom muito suave."""
    png = os.path.join(TMP, f"{nome}.png")
    img.convert("RGB").save(png)
    saida = os.path.join(TMP, f"{nome}.mp4")
    n = int(dur * FPS)
    vf = (
        f"scale={W * 2}:{H * 2},zoompan=z='1+({zoom_fim}-1)*on/{n}':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2':d={n}:s={W}x{H}:fps={FPS},"
        f"fade=in:st=0:d=0.6"
    )
    ff("-loop", "1", "-i", png, "-vf", vf, "-frames:v", str(n), "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p", saida)
    return saida


def juntar(clipes, duracoes, saida):
    """Liga os clipes com transições suaves (xfade)."""
    entradas = []
    for c in clipes:
        entradas += ["-i", c]
    filtro = []
    acum = duracoes[0]
    ant = "[0:v]"
    for i in range(1, len(clipes)):
        off = acum - XFADE
        lab = f"[x{i}]"
        filtro.append(f"{ant}[{i}:v]xfade=transition=fade:duration={XFADE}:offset={off:.3f}{lab}")
        ant = lab
        acum = off + duracoes[i]
    filtro.append(f"{ant}fade=out:st={acum - 0.6:.3f}:d=0.6,format=yuv420p[v]")
    ff(*entradas, "-filter_complex", ";".join(filtro), "-map", "[v]", "-r", str(FPS),
       "-c:v", "libx264", "-crf", "18", "-preset", "slow", "-profile:v", "high", "-pix_fmt", "yuv420p",
       "-movflags", "+faststart", saida)
    return acum


def main():
    os.makedirs(TMP, exist_ok=True)
    os.makedirs(OUT, exist_ok=True)
    fundo_img().save(os.path.join(TMP, "fundo.png"))
    moldura_img().save(os.path.join(TMP, "moldura.png"))
    so = sys.argv[1:]

    clipes, duracoes, nomes = [], [], []
    intro = os.path.join(TMP, "intro.mp4")
    if not so or "intro" in so or not os.path.exists(intro):
        intro = montar_quadro("intro", intro_img(), INTRO)
    clipes.append(intro); duracoes.append(INTRO); nomes.append("intro")
    for sid, trechos, dur, texto, zoom, cy in CENAS:
        arq = os.path.join(TMP, f"{sid}.mp4")
        if not so or sid in so or not os.path.exists(arq):
            print("cena", sid)
            arq = montar_cena(sid, trechos, dur, texto, zoom, cy)
        clipes.append(arq); duracoes.append(dur); nomes.append(sid)
    outro = os.path.join(TMP, "outro.mp4")
    if not so or "outro" in so or not os.path.exists(outro):
        outro = montar_quadro("outro", outro_img(), OUTRO, zoom_fim=1.03)
    clipes.append(outro); duracoes.append(OUTRO); nomes.append("outro")

    final = os.path.join(OUT, "levia-promo.mp4")
    total = juntar(clipes, duracoes, final)
    print(f"vídeo: {final} ({total:.1f} s)")

    # tempos de cada cena no vídeo final (para a narração e para a revisão)
    tempos, t = [], 0.0
    for i, (n, d) in enumerate(zip(nomes, duracoes)):
        ini = t if i == 0 else t
        fim = ini + d - (XFADE if i < len(nomes) - 1 else 0)
        tempos.append((n, ini, fim))
        t = fim
    with open(os.path.join(GRAV, "tempos.json"), "w") as f:
        json.dump(tempos, f)
    mmss = lambda s: f"{int(s // 60)}:{s % 60:04.1f}"
    with open(os.path.join(OUT, "roteiro-narracao.txt"), "w") as f:
        f.write("LevIA · vídeo promocional · roteiro de narração\n")
        f.write(f"(duração total {total:.1f} s; tempos do vídeo final; fale com calma, ~2,5 palavras por segundo)\n\n")
        for n, ini, fim in tempos:
            f.write(f"{mmss(ini)} – {mmss(fim)}  {n.upper()}\n  {NARRACAO[n]}\n\n")

    # GIF de ~12 s com o melhor trecho (do mapa até o fim da conversa), 960 px, paleta própria
    ini_gif = next(i for n, i, _ in tempos if n == "s02")
    gif = os.path.join(OUT, "levia-promo.gif")
    pal = os.path.join(TMP, "paleta.png")
    ff("-ss", f"{ini_gif:.2f}", "-t", "12", "-i", final, "-vf", "fps=12,scale=960:-1:flags=lanczos,palettegen=stats_mode=diff", pal)
    ff("-ss", f"{ini_gif:.2f}", "-t", "12", "-i", final, "-i", pal,
       "-lavfi", "fps=12,scale=960:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=4", gif)

    # thumbnail: mapa do corpo com ombros marcados e o texto "Toque onde dói"
    s02 = next((i, f) for n, i, f in tempos if n == "s02")
    ff("-ss", f"{s02[0] + 4.2:.2f}", "-i", final, "-frames:v", "1", os.path.join(OUT, "levia-promo-thumbnail.png"))
    print("pronto:", ", ".join(sorted(os.listdir(OUT))))


if __name__ == "__main__":
    main()
