#!/usr/bin/env python3
"""Grava as cenas do vídeo promocional direto do celular Android (adb screenrecord).

Não é código do app. Interage como uma pessoa: acha cada elemento pela árvore de acessibilidade,
toca nele (com "Mostrar toques" ligado), digita letra a letra com ritmo variado e faz pausas.

uso: python3 promo-video/gravar.py [cena ...]        (sem argumentos: todas as cenas, em ordem)
     python3 promo-video/gravar.py preparar           (só prepara o celular)
     python3 promo-video/gravar.py restaurar          (devolve as configurações originais)
"""
import os
import random
import re
import subprocess
import sys
import time

ADB = os.path.expanduser("~/Android/Sdk/platform-tools/adb")
PASTA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "gravacao")
APP = "br.com.levia.app"
random.seed(1108)


def adb(*args, capture=False, check=False):
    r = subprocess.run([ADB, *args], capture_output=True, text=True)
    if check and r.returncode != 0:
        raise RuntimeError(f"adb {' '.join(args)}: {r.stderr.strip()}")
    return r.stdout if capture else None


def sh(cmd, capture=False):
    return adb("shell", cmd, capture=capture)


def pausa(seg=0.6):
    time.sleep(seg)


# ---------- árvore de acessibilidade ----------

def nos():
    sh("rm -f /sdcard/ui.xml")
    sh("uiautomator dump /sdcard/ui.xml >/dev/null 2>&1")
    xml = adb("exec-out", "cat /sdcard/ui.xml", capture=True) or ""
    out = []
    for m in re.finditer(r"<node [^>]*>", xml):
        n = m.group(0)
        g = lambda k: (re.search(k + r'="([^"]*)"', n) or [None, ""])[1]
        b = [int(x) for x in re.findall(r"\d+", g("bounds"))]
        if len(b) == 4:
            out.append({"texto": g("text"), "desc": g("content-desc"), "b": b, "clicavel": g("clickable") == "true"})
    return out


def achar(padrao, tentativas=12, preferir_clicavel=True):
    rx = re.compile(padrao)
    for _ in range(tentativas):
        cand = [n for n in nos() if rx.fullmatch(n["desc"]) or rx.fullmatch(n["texto"])]
        if preferir_clicavel and any(n["clicavel"] for n in cand):
            cand = [n for n in cand if n["clicavel"]]
        if cand:
            return cand[0]
        time.sleep(0.5)
    raise RuntimeError(f"não achei: {padrao}")


def tocar(padrao, depois=0.7):
    n = achar(padrao)
    x0, y0, x1, y1 = n["b"]
    sh(f"input tap {(x0 + x1) // 2} {(y0 + y1) // 2}")
    pausa(depois)


def tocar_xy(x, y, depois=0.7):
    sh(f"input tap {x} {y}")
    pausa(depois)


def digitar(texto):
    """Letra a letra, com pequenas variações de ritmo (só ASCII: o adb não digita acentos)."""
    for c in texto:
        sh("input text %s" % ("%s" if c == " " else c.replace("'", "\\'")))
        time.sleep(random.uniform(0.04, 0.14))


def responder(texto, espera=1.6):
    tocar("Mensagem", depois=0.3)
    digitar(texto)
    pausa(0.35)
    tocar("Enviar", depois=espera)


def rolar(de=1700, ate=900, ms=900, depois=0.8):
    sh(f"input swipe 540 {de} 540 {ate} {ms}")
    pausa(depois)


def aba(nome):
    tocar(nome, depois=1.2)


# ---------- gravação ----------

class Gravacao:
    def __init__(self, nome):
        self.nome = nome
        self.remoto = f"/sdcard/levia-{nome}.mp4"

    def __enter__(self):
        sh(f"rm -f {self.remoto}")
        self.p = subprocess.Popen([ADB, "shell", "screenrecord", "--bit-rate", "16000000", self.remoto])
        pausa(1.5)  # folga no início
        return self

    def __exit__(self, *exc):
        pausa(1.5)  # folga no fim
        sh("pkill -INT screenrecord")
        self.p.wait(timeout=15)
        pausa(1.0)
        os.makedirs(PASTA, exist_ok=True)
        adb("pull", self.remoto, os.path.join(PASTA, f"{self.nome}.mp4"))
        sh(f"rm -f {self.remoto}")
        print(f"  gravada: {self.nome}.mp4")


# ---------- preparar e restaurar o celular ----------

def preparar():
    sh("cmd uimode night no")  # tema claro: as cores principais da LevIA
    sh("settings put system show_touches 1")  # toques visíveis
    # barra de status limpa (modo demonstração do Android)
    sh("settings put global sysui_demo_allowed 1")
    for c in [
        "-e command enter",
        "-e command clock -e hhmm 0941",
        "-e command battery -e level 100 -e plugged false",
        "-e command network -e wifi show -e level 4 -e mobile show -e datatype none -e level 4",
        "-e command notifications -e visible false",
        "-e command status -e volume hide -e bluetooth hide -e alarm hide -e mute hide -e sync hide",
    ]:
        sh(f"am broadcast -a com.android.systemui.demo {c} >/dev/null")
    sh(f"pm grant {APP} android.permission.RECORD_AUDIO")
    sh(f"pm grant {APP} android.permission.POST_NOTIFICATIONS")  # senão o pedido de permissão cobre a tela
    adb("reverse", "tcp:3333", "tcp:3333")
    pausa(1.5)


def restaurar():
    orig = dict(l.strip().split("=", 1) for l in open(os.path.join(PASTA, "config-original.txt")) if "=" in l)
    sh("am broadcast -a com.android.systemui.demo -e command exit >/dev/null")
    sh(f"settings put global sysui_demo_allowed {orig.get('sysui_demo_allowed', '0')}")
    sh(f"settings put system show_touches {orig.get('show_touches', '0')}")
    sh(f"cmd uimode night {orig.get('night', 'yes')}")
    print("celular restaurado:", orig)


def abrir_limpo():
    """App zerado (novo aparelho), consentimento aceito fora da câmera, no Início."""
    sh(f"pm clear {APP}")
    sh(f"pm grant {APP} android.permission.RECORD_AUDIO")
    sh(f"pm grant {APP} android.permission.POST_NOTIFICATIONS")
    sh(f"am start -n {APP}/.MainActivity >/dev/null")
    pausa(6)
    tocar("Aceito", depois=2.5)


# ---------- cenas ----------

def c01_inicio():
    with Gravacao("c01-inicio"):
        pausa(1.2)
        tocar("Precisa de ajuda.*", depois=2.2)


def c02_mapa():
    with Gravacao("c02-mapa"):
        tocar("Abrir o mapa do corpo", depois=1.6)
        tocar("ombros, de frente", depois=1.4)
        tocar("Pronto", depois=2.0)


def c03_conversa():
    with Gravacao("c03-conversa"):
        responder("faz uns 3 dias")
        responder("3")
        for _ in range(3):
            responder("nenhuma")
        for _ in range(8):
            responder("discordo", espera=1.3)
        responder("pouco", espera=1.8)


def c04_resultado():
    with Gravacao("c04-resultado"):
        responder("sim", espera=3.0)
        tocar("Por quê\\?", depois=2.5)


def c05_exercicios():
    with Gravacao("c05-exercicios"):
        aba("Exercícios")
        pausa(3.5)  # o vídeo do ombro tocando
        rolar(1500, 1050, 800, depois=1.2)
        tocar("Fiz!", depois=2.5)


def c06_ritmo():
    with Gravacao("c06-ritmo"):
        aba("Ritmo")
        tocar("Apelido para a sua equipe", depois=0.6)
        digitar("Mariana")
        pausa(0.5)
        sh("input keyevent 4")  # fecha o teclado
        pausa(0.6)
        tocar("Entrar no Ritmo", depois=2.5)
        rolar(1700, 1000, 1200, depois=2.0)


def c07_piora():
    with Gravacao("c07-piora"):
        aba("Início")
        tocar("Minha dor piorou.*", depois=2.4)
        responder("5")
        responder("sim")
        responder("nenhuma")  # aperto no peito, falta de ar
        responder("estou com febre", espera=1.8)  # sinal de alerta perguntado para dor no ombro
        responder("nenhuma", espera=1.8)
        responder("sim", espera=3.5)


def c08_voz():
    with Gravacao("c08-voz"):
        tocar("Modo conversa por voz", depois=4.5)
        tocar("Modo conversa por voz", depois=1.2)  # desliga no fim da cena


def c09_rh():
    with Gravacao("c09-rh"):
        aba("RH")
        pausa(2.5)
        rolar(1800, 900, 1400, depois=1.5)
        rolar(1800, 700, 1400, depois=1.5)
        rolar(1800, 700, 1400, depois=2.0)


CENAS = [c01_inicio, c02_mapa, c03_conversa, c04_resultado, c05_exercicios, c06_ritmo, c07_piora, c08_voz, c09_rh]


def main():
    args = sys.argv[1:]
    if args == ["preparar"]:
        return preparar()
    if args == ["restaurar"]:
        return restaurar()
    escolhidas = [c for c in CENAS if not args or any(c.__name__.startswith(a) for a in args)]
    preparar()
    if not args or escolhidas[0] is c01_inicio:
        abrir_limpo()
    try:
        for c in escolhidas:
            print("cena", c.__name__)
            c()
    finally:
        print("(as configurações do celular continuam de gravação; rode 'restaurar' no fim)")


if __name__ == "__main__":
    main()
