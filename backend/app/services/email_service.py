from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email, To, Content
import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)


class EmailDeliveryError(Exception):
    pass


def get_sendgrid_client() -> Optional[SendGridAPIClient]:
    """Get SendGrid client if API key is configured"""
    api_key = os.getenv('SENDGRID_API_KEY')
    if not api_key:
        logger.warning("SendGrid API key not configured")
        return None
    return SendGridAPIClient(api_key)


def send_email(
    to_email: str,
    subject: str,
    html_content: str,
    plain_content: Optional[str] = None
) -> bool:
    """
    Send email via SendGrid
    
    Args:
        to_email: Recipient email address
        subject: Email subject line
        html_content: HTML email content
        plain_content: Plain text fallback (optional)
    
    Returns:
        True if email sent successfully, False otherwise
    """
    sg = get_sendgrid_client()
    sender_email = os.getenv('SENDER_EMAIL', 'noreply@playtraderz.com')
    
    if not sg:
        # Log the email instead if SendGrid not configured
        logger.info(f"[EMAIL MOCK] To: {to_email}, Subject: {subject}")
        logger.info(f"[EMAIL MOCK] Content: {html_content[:200]}...")
        return True
    
    message = Mail(
        from_email=Email(sender_email, "PlayTraderz"),
        to_emails=To(to_email),
        subject=subject,
        html_content=Content("text/html", html_content)
    )
    
    if plain_content:
        message.add_content(Content("text/plain", plain_content))
    
    try:
        response = sg.send(message)
        if response.status_code in [200, 201, 202]:
            logger.info(f"Email sent successfully to {to_email}")
            return True
        else:
            logger.error(f"Email send failed with status {response.status_code}")
            return False
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {str(e)}")
        raise EmailDeliveryError(f"Failed to send email: {str(e)}")


def send_password_reset_email(to_email: str, reset_token: str, frontend_url: str) -> bool:
    """Send password reset email"""
    reset_link = f"{frontend_url}/reset-password?token={reset_token}"
    
    subject = "Reset Your PlayTraderz Password"
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0a0a0a; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #1a1a1a; border-radius: 12px; overflow: hidden;">
            <div style="background: linear-gradient(135deg, #13ec5b 0%, #0fb34a 100%); padding: 30px; text-align: center;">
                <h1 style="color: #000; margin: 0; font-size: 28px; font-weight: bold;">PlayTraderz</h1>
            </div>
            <div style="padding: 40px 30px;">
                <h2 style="color: #ffffff; margin: 0 0 20px 0; font-size: 24px;">Password Reset Request</h2>
                <p style="color: #a0a0a0; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                    We received a request to reset your password. Click the button below to create a new password.
                </p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{reset_link}" style="display: inline-block; background-color: #13ec5b; color: #000; text-decoration: none; padding: 14px 40px; border-radius: 8px; font-weight: bold; font-size: 16px;">
                        Reset Password
                    </a>
                </div>
                <p style="color: #a0a0a0; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0;">
                    If you didn't request this, you can safely ignore this email. The link will expire in 1 hour.
                </p>
                <p style="color: #666; font-size: 12px; margin: 20px 0 0 0; word-break: break-all;">
                    Or copy this link: {reset_link}
                </p>
            </div>
            <div style="background-color: #111; padding: 20px 30px; text-align: center;">
                <p style="color: #666; font-size: 12px; margin: 0;">
                    © 2026 PlayTraderz. All rights reserved.
                </p>
            </div>
        </div>
    </body>
    </html>
    """
    
    return send_email(to_email, subject, html_content)


def send_order_notification_email(
    to_email: str,
    order_number: str,
    notification_type: str,
    details: dict
) -> bool:
    """Send order-related notification email"""
    
    subjects = {
        "order_created": f"Order {order_number} - Purchase Confirmed",
        "order_delivered": f"Order {order_number} - Account Delivered",
        "order_completed": f"Order {order_number} - Transaction Complete",
        "order_disputed": f"Order {order_number} - Dispute Opened",
        "order_refunded": f"Order {order_number} - Refund Processed",
    }
    
    subject = subjects.get(notification_type, f"Order {order_number} Update")
    
    messages = {
        "order_created": "Your purchase has been confirmed. The seller will deliver the account details soon.",
        "order_delivered": "The seller has delivered the account details. Please review and confirm receipt.",
        "order_completed": "The transaction is complete. Thank you for using PlayTraderz!",
        "order_disputed": "A dispute has been opened for this order. Our team will review it shortly.",
        "order_refunded": "Your refund has been processed and returned to your wallet.",
    }
    
    message = messages.get(notification_type, "Your order has been updated.")
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0a0a0a; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #1a1a1a; border-radius: 12px; overflow: hidden;">
            <div style="background: linear-gradient(135deg, #13ec5b 0%, #0fb34a 100%); padding: 20px; text-align: center;">
                <h1 style="color: #000; margin: 0; font-size: 24px;">PlayTraderz</h1>
            </div>
            <div style="padding: 30px;">
                <h2 style="color: #ffffff; margin: 0 0 15px 0; font-size: 20px;">Order Update: {order_number}</h2>
                <p style="color: #a0a0a0; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                    {message}
                </p>
                <div style="background-color: #111; border-radius: 8px; padding: 15px; margin: 20px 0;">
                    <p style="color: #666; font-size: 14px; margin: 0;">
                        <strong style="color: #13ec5b;">Amount:</strong> ${details.get('amount', 'N/A')}
                    </p>
                </div>
                <div style="text-align: center; margin-top: 20px;">
                    <a href="{details.get('frontend_url', '')}/order/{details.get('order_id', '')}" style="display: inline-block; background-color: #13ec5b; color: #000; text-decoration: none; padding: 12px 30px; border-radius: 8px; font-weight: bold;">
                        View Order
                    </a>
                </div>
            </div>
        </div>
    </body>
    </html>
    """
    
    return send_email(to_email, subject, html_content)


def send_kyc_status_email(to_email: str, status: str, reason: Optional[str] = None) -> bool:
    """Send KYC status update email"""
    
    if status == "approved":
        subject = "KYC Verification Approved - You Can Now Sell!"
        message = "Congratulations! Your KYC verification has been approved. You can now create listings and start selling game accounts on PlayTraderz."
        cta_text = "Start Selling"
        cta_link = "/seller/create-listing"
    else:
        subject = "KYC Verification Update Required"
        message = f"Your KYC verification was not approved. Reason: {reason or 'Please contact support for details.'}"
        cta_text = "Resubmit KYC"
        cta_link = "/kyc"
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0a0a0a; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #1a1a1a; border-radius: 12px; overflow: hidden;">
            <div style="background: linear-gradient(135deg, #13ec5b 0%, #0fb34a 100%); padding: 20px; text-align: center;">
                <h1 style="color: #000; margin: 0; font-size: 24px;">PlayTraderz</h1>
            </div>
            <div style="padding: 30px;">
                <h2 style="color: #ffffff; margin: 0 0 15px 0; font-size: 20px;">KYC Verification Update</h2>
                <p style="color: #a0a0a0; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                    {message}
                </p>
                <div style="text-align: center; margin-top: 20px;">
                    <a href="{cta_link}" style="display: inline-block; background-color: #13ec5b; color: #000; text-decoration: none; padding: 12px 30px; border-radius: 8px; font-weight: bold;">
                        {cta_text}
                    </a>
                </div>
            </div>
        </div>
    </body>
    </html>
    """
    
    return send_email(to_email, subject, html_content)
