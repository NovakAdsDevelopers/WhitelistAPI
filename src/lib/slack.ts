import axios from "axios";

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL!;

export async function sendSlackAlert(message: string) {
  try {
    await axios.post(SLACK_WEBHOOK_URL, {
      text: message,
    });
  } catch (error) {
    console.error("Erro ao enviar mensagem para o Slack:", error);
  }
}
