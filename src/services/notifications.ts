export interface ReminderService {
  enable(): Promise<boolean>;
  showDue(count: number): void;
}
export const reminders: ReminderService = {
  async enable() {
    if (!("Notification" in window))
      throw new Error("Этот браузер не поддерживает уведомления");
    return (await Notification.requestPermission()) === "granted";
  },
  showDue(count) {
    if (
      "Notification" in window &&
      Notification.permission === "granted" &&
      count > 0
    )
      new Notification("Easy Learn", {
        body: `Слов к повторению: ${count}. Небольшая практика в вашем ритме.`,
        icon: "/favicon.svg",
        tag: "easy-learn-review",
      });
  },
};
