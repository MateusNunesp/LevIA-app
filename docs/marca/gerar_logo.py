#!/usr/bin/env python3
"""Gera os arquivos da logo da LevIA (símbolo de pulso num círculo + nome em Atkinson Hyperlegible Bold).

uso (na raiz do repositório): python3 docs/marca/gerar_logo.py
"""
import math
import os

import cairo
from PIL import Image, ImageDraw, ImageFont

AQUI = os.path.dirname(os.path.abspath(__file__))
FONTE = os.path.join(AQUI, "..", "..", "node_modules", "@expo-google-fonts", "atkinson-hyperlegible", "700Bold", "AtkinsonHyperlegible_700Bold.ttf")

PETROLEO = "#1f6f5c"       # primária
PROFUNDO = "#12443a"       # petróleo profundo (nome no fundo claro)
CREME = "#fbfaf7"          # pulso e nome no fundo escuro
# traço de pulso no quadro 28x28 (o mesmo do avatar da conversa)
PULSO = [(4, 16), (9, 16), (11, 10), (15, 20), (17, 16), (24, 16)]


def simbolo_svg() -> str:
    d = "M" + " L".join(f"{x} {y}" for x, y in PULSO)
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="512" height="512" role="img" aria-label="LevIA">
  <circle cx="14" cy="14" r="14" fill="{PETROLEO}"/>
  <path d="{d}" fill="none" stroke="{CREME}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
'''


def _cor(h: str) -> tuple[float, float, float]:
    return tuple(int(h[i : i + 2], 16) / 255 for i in (1, 3, 5))  # type: ignore[return-value]


def simbolo_img(tam: int) -> Image.Image:
    """Símbolo desenhado com cairo: antisserrilhado, pontas e dobras do pulso arredondadas (igual ao SVG)."""
    sup = cairo.ImageSurface(cairo.FORMAT_ARGB32, tam, tam)
    cr = cairo.Context(sup)
    cr.scale(tam / 28, tam / 28)
    cr.arc(14, 14, 14, 0, 2 * math.pi)
    cr.set_source_rgb(*_cor(PETROLEO))
    cr.fill()
    cr.move_to(*PULSO[0])
    for x, y in PULSO[1:]:
        cr.line_to(x, y)
    cr.set_source_rgb(*_cor(CREME))
    cr.set_line_width(2.4)
    cr.set_line_cap(cairo.LINE_CAP_ROUND)
    cr.set_line_join(cairo.LINE_JOIN_ROUND)
    cr.stroke()
    # cairo guarda BGRA com alfa pré-multiplicado; o PIL lê como "RGBa"
    return Image.frombuffer("RGBa", (tam, tam), bytes(sup.get_data()), "raw", "BGRa", sup.get_stride(), 1).convert("RGBA")


def simbolo_png(tam: int, caminho: str) -> None:
    simbolo_img(tam).save(caminho)


def logo_png(altura: int, cor_nome: str, caminho: str) -> None:
    esc = 2
    h = altura * esc
    f = ImageFont.truetype(FONTE, int(h * 0.78))
    medida = ImageDraw.Draw(Image.new("RGBA", (1, 1))).textbbox((0, 0), "LevIA", font=f, anchor="lm")
    largura_nome = medida[2] - medida[0]
    vao = int(h * 0.32)
    w = h + vao + largura_nome + int(h * 0.06)
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    im.alpha_composite(simbolo_img(h), (0, 0))
    d = ImageDraw.Draw(im)
    d.text((h + vao, h // 2), "LevIA", font=f, fill=cor_nome, anchor="lm")
    im.resize((w // esc, altura), Image.LANCZOS).save(caminho)


def main() -> None:
    with open(os.path.join(AQUI, "levia-simbolo.svg"), "w") as f:
        f.write(simbolo_svg())
    simbolo_png(1024, os.path.join(AQUI, "levia-simbolo-1024.png"))
    simbolo_png(512, os.path.join(AQUI, "levia-simbolo-512.png"))
    logo_png(400, PROFUNDO, os.path.join(AQUI, "levia-logo-fundo-claro.png"))
    logo_png(400, CREME, os.path.join(AQUI, "levia-logo-fundo-escuro.png"))
    print("pronto:", ", ".join(sorted(x for x in os.listdir(AQUI) if x.startswith("levia-"))))


if __name__ == "__main__":
    main()
