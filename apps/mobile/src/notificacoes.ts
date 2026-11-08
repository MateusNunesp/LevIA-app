// Lembretes LOCAIS (sem servidor de push). O texto nunca tem conteúdo de saúde.
import * as Notifications from "expo-notifications";

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

export async function agendarChecagens(datas: string[], texto: string): Promise<void> {
  try {
    const perm = await Notifications.requestPermissionsAsync();
    if (!perm.granted) return;
    await Notifications.cancelAllScheduledNotificationsAsync();
    const agora = Date.now();
    for (const d of datas) {
      const quando = new Date(`${d}T09:00:00`);
      if (quando.getTime() <= agora) continue;
      await Notifications.scheduleNotificationAsync({
        content: { title: "LevIA", body: texto },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: quando },
      });
    }
  } catch {
    // sem notificações: a checagem também aparece na conversa e na aba Exercícios
  }
}

export async function cancelarLembretes(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // sem lembretes agendados: nada a cancelar
  }
}
