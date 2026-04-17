import smtplib
import os
import sys
import json
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

load_dotenv()

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
NOTIFY_TO = os.getenv("NOTIFY_TO", SMTP_USER)

def send_failure_email(host: str, error: str = "", raw: str = "") -> dict:
    if not SMTP_USER or not SMTP_PASSWORD:
        return {"sent": False, "error": "SMTP_USER or SMTP_PASSWORD not set in .env"}

    subject = f"[ALERT] {host} is OFFLINE"
    body_plain = f"""Host {host} failed its connectivity check.

Error: {error or "No response"}

Raw output:
{raw or "(none)"}

Check the server immediately.
"""

    msg = MIMEMultipart("alternative")
    msg["From"] = SMTP_USER
    msg["To"] = NOTIFY_TO
    msg["Subject"] = subject
    msg.attach(MIMEText(body_plain, "plain"))

    # Try to load HTML template
    template_path = os.path.join(os.path.dirname(__file__), "templates", "alert_email.html")
    if os.path.exists(template_path):
        import datetime
        with open(template_path, "r", encoding="utf-8") as f:
            html_template = f.read()
        
        body_html = html_template.replace("{{host}}", host)
        body_html = body_html.replace("{{error}}", error or "No response")
        body_html = body_html.replace("{{raw}}", raw or "(none)")
        body_html = body_html.replace("{{timestamp}}", datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
        
        msg.attach(MIMEText(body_html, "html"))

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.ehlo()
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_USER, NOTIFY_TO, msg.as_string())
        return {"sent": True, "to": NOTIFY_TO}
    except Exception as e:
        return {"sent": False, "error": str(e)}


if __name__ == "__main__":
    # Accepts JSON ping result on stdin or as first arg
    if len(sys.argv) > 1:
        ping_result = json.loads(sys.argv[1])
    else:
        ping_result = json.loads(sys.stdin.read())

    result = send_failure_email(
        host=ping_result.get("host", "unknown"),
        error=ping_result.get("error", ""),
        raw=ping_result.get("raw", ""),
    )
    print(json.dumps(result, indent=2))
