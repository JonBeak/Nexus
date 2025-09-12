#!/usr/bin/env python3
"""
Sign Manufacturing Email System
Professional SMTP-based email system for business communications
Replaces unreliable Outlook COM with server-based SMTP
"""

import smtplib
import ssl
import json
import os
import logging
import mysql.connector
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from datetime import datetime
from typing import Dict, List, Optional
from dataclasses import dataclass

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@dataclass
class EmailConfig:
    """Email configuration settings"""
    smtp_server: str
    smtp_port: int
    username: str
    password: str
    use_tls: bool = True
    use_ssl: bool = False

@dataclass
class EmailMessage:
    """Email message structure"""
    to_email: str
    subject: str
    body: str
    from_email: str = ""
    cc_email: str = ""
    bcc_email: str = ""
    attachments: List[str] = None
    email_type: str = "general"
    related_to_type: str = ""
    related_to_id: int = 0

class DatabaseManager:
    """Handles database operations for email system"""
    
    def __init__(self, config_file="/home/jon/Nexus/database_config.json"):
        self.config_file = config_file
        self.connection = None
        self.load_config()
    
    def load_config(self):
        """Load database configuration"""
        try:
            with open(self.config_file, 'r') as f:
                self.db_config = json.load(f)
        except FileNotFoundError:
            logger.warning(f"Database config file not found: {self.config_file}")
            self.db_config = {
                "host": "localhost",
                "user": "root",
                "password": "",
                "database": "sign_manufacturing"
            }
    
    def connect(self):
        """Establish database connection"""
        try:
            self.connection = mysql.connector.connect(**self.db_config)
            logger.info("Database connection established")
            return True
        except mysql.connector.Error as e:
            logger.error(f"Database connection failed: {e}")
            return False
    
    def disconnect(self):
        """Close database connection"""
        if self.connection and self.connection.is_connected():
            self.connection.close()
            logger.info("Database connection closed")
    
    def get_email_config(self) -> Optional[EmailConfig]:
        """Retrieve email configuration from database"""
        if not self.connection or not self.connection.is_connected():
            if not self.connect():
                return None
        
        try:
            cursor = self.connection.cursor()
            cursor.execute("""
                SELECT config_key, config_value 
                FROM system_config 
                WHERE config_key LIKE 'smtp_%'
            """)
            
            config_data = {}
            for key, value in cursor.fetchall():
                config_data[key] = value
            
            cursor.close()
            
            if 'smtp_server' in config_data:
                return EmailConfig(
                    smtp_server=config_data.get('smtp_server', ''),
                    smtp_port=int(config_data.get('smtp_port', 587)),
                    username=config_data.get('smtp_username', ''),
                    password=config_data.get('smtp_password', ''),
                    use_tls=config_data.get('smtp_use_tls', 'true').lower() == 'true'
                )
            else:
                logger.warning("SMTP configuration not found in database")
                return None
                
        except mysql.connector.Error as e:
            logger.error(f"Failed to retrieve email config: {e}")
            return None
    
    def log_email(self, email_msg: EmailMessage, status: str):
        """Log email communication to database"""
        if not self.connection or not self.connection.is_connected():
            if not self.connect():
                return False
        
        try:
            cursor = self.connection.cursor()
            cursor.execute("""
                INSERT INTO email_communications 
                (related_to_type, related_to_id, email_type, to_email, from_email, 
                 cc_email, subject, message_body, delivery_status, sent_date, created_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                email_msg.related_to_type,
                email_msg.related_to_id,
                email_msg.email_type,
                email_msg.to_email,
                email_msg.from_email,
                email_msg.cc_email,
                email_msg.subject,
                email_msg.body,
                status,
                datetime.now(),
                os.getenv('USER', 'system')
            ))
            
            self.connection.commit()
            cursor.close()
            logger.info(f"Email logged to database with status: {status}")
            return True
            
        except mysql.connector.Error as e:
            logger.error(f"Failed to log email: {e}")
            return False

class EmailSystem:
    """Main email system class"""
    
    def __init__(self):
        self.db_manager = DatabaseManager()
        self.email_config = None
        self.load_email_config()
    
    def load_email_config(self):
        """Load email configuration from database or config file"""
        # Try to load from database first
        self.email_config = self.db_manager.get_email_config()
        
        # Fallback to config file
        if not self.email_config:
            try:
                with open('/home/jon/Nexus/email_config.json', 'r') as f:
                    config_data = json.load(f)
                    self.email_config = EmailConfig(**config_data)
                    logger.info("Email config loaded from file")
            except FileNotFoundError:
                logger.error("No email configuration found")
                self.email_config = None
    
    def send_email(self, email_msg: EmailMessage) -> bool:
        """Send email using SMTP"""
        if not self.email_config:
            logger.error("Email configuration not available")
            return False
        
        if not email_msg.from_email:
            email_msg.from_email = self.email_config.username
        
        try:
            # Create message
            msg = MIMEMultipart()
            msg['From'] = email_msg.from_email
            msg['To'] = email_msg.to_email
            msg['Subject'] = email_msg.subject
            
            if email_msg.cc_email:
                msg['Cc'] = email_msg.cc_email
            
            # Attach body
            msg.attach(MIMEText(email_msg.body, 'plain'))
            
            # Handle attachments
            if email_msg.attachments:
                for file_path in email_msg.attachments:
                    if os.path.isfile(file_path):
                        with open(file_path, "rb") as attachment:
                            part = MIMEBase('application', 'octet-stream')
                            part.set_payload(attachment.read())
                        
                        encoders.encode_base64(part)
                        part.add_header(
                            'Content-Disposition',
                            f'attachment; filename= {os.path.basename(file_path)}'
                        )
                        msg.attach(part)
            
            # Connect to server and send email
            context = ssl.create_default_context()
            
            if self.email_config.use_ssl:
                server = smtplib.SMTP_SSL(self.email_config.smtp_server, self.email_config.smtp_port, context=context)
            else:
                server = smtplib.SMTP(self.email_config.smtp_server, self.email_config.smtp_port)
                if self.email_config.use_tls:
                    server.starttls(context=context)
            
            server.login(self.email_config.username, self.email_config.password)
            
            # Send email
            recipients = [email_msg.to_email]
            if email_msg.cc_email:
                recipients.extend([email.strip() for email in email_msg.cc_email.split(',')])
            if email_msg.bcc_email:
                recipients.extend([email.strip() for email in email_msg.bcc_email.split(',')])
            
            server.send_message(msg, to_addrs=recipients)
            server.quit()
            
            logger.info(f"Email sent successfully to {email_msg.to_email}")
            self.db_manager.log_email(email_msg, 'sent')
            return True
            
        except Exception as e:
            logger.error(f"Failed to send email: {e}")
            self.db_manager.log_email(email_msg, 'failed')
            return False
    
    def send_purchase_order_email(self, po_id: int, supplier_email: str) -> bool:
        """Send purchase order email to supplier"""
        # Get PO details from database
        if not self.db_manager.connect():
            return False
        
        try:
            cursor = self.db_manager.connection.cursor()
            cursor.execute("""
                SELECT po.po_number, po.po_date, po.total_amount, s.company_name, s.contact_name
                FROM purchase_orders po
                JOIN suppliers s ON po.supplier_id = s.supplier_id
                WHERE po.po_id = %s
            """, (po_id,))
            
            po_data = cursor.fetchone()
            if not po_data:
                logger.error(f"Purchase order {po_id} not found")
                return False
            
            po_number, po_date, total_amount, supplier_name, contact_name = po_data
            
            # Get line items
            cursor.execute("""
                SELECT description, quantity, unit_price, line_total
                FROM po_line_items
                WHERE po_id = %s
                ORDER BY po_line_id
            """, (po_id,))
            
            line_items = cursor.fetchall()
            cursor.close()
            
            # Create email content
            subject = f"Purchase Order {po_number}"
            
            body = f"""Dear {contact_name or supplier_name},

Please find attached our Purchase Order {po_number} dated {po_date}.

Order Summary:
"""
            
            for description, quantity, unit_price, line_total in line_items:
                body += f"- {description}: {quantity} @ ${unit_price:.2f} = ${line_total:.2f}\n"
            
            body += f"""
Total Amount: ${total_amount:.2f}

Please confirm receipt of this order and provide expected delivery date.

Best regards,
{os.getenv('USER', 'Sign Manufacturing Team')}
"""
            
            email_msg = EmailMessage(
                to_email=supplier_email,
                subject=subject,
                body=body,
                email_type="purchase_order",
                related_to_type="purchase_order",
                related_to_id=po_id
            )
            
            return self.send_email(email_msg)
            
        except mysql.connector.Error as e:
            logger.error(f"Database error in PO email: {e}")
            return False
    
    def send_job_status_update(self, job_id: int, customer_email: str, status_change: str) -> bool:
        """Send job status update to customer"""
        if not self.db_manager.connect():
            return False
        
        try:
            cursor = self.db_manager.connection.cursor()
            cursor.execute("""
                SELECT j.job_number, j.job_title, j.job_status, c.company_name, c.contact_first_name, c.contact_last_name
                FROM jobs j
                JOIN customers c ON j.customer_id = c.customer_id
                WHERE j.job_id = %s
            """, (job_id,))
            
            job_data = cursor.fetchone()
            if not job_data:
                logger.error(f"Job {job_id} not found")
                return False
            
            job_number, job_title, job_status, company_name, first_name, last_name = job_data
            cursor.close()
            
            contact_name = f"{first_name} {last_name}".strip() if first_name or last_name else "Valued Customer"
            
            status_messages = {
                'approved': 'has been approved and is now in our production queue',
                'in_production': 'is currently being manufactured',
                'ready_for_pickup': 'is complete and ready for pickup',
                'completed': 'has been completed and delivered'
            }
            
            status_message = status_messages.get(job_status, f'status has been updated to: {job_status}')
            
            subject = f"Job Update - {job_number}: {job_title}"
            
            body = f"""Dear {contact_name},

We wanted to update you on your sign project:

Job Number: {job_number}
Project: {job_title}
Customer: {company_name}

Your order {status_message}.

{status_change}

If you have any questions, please don't hesitate to contact us.

Best regards,
Sign Manufacturing Team
"""
            
            email_msg = EmailMessage(
                to_email=customer_email,
                subject=subject,
                body=body,
                email_type="status_update",
                related_to_type="job",
                related_to_id=job_id
            )
            
            return self.send_email(email_msg)
            
        except mysql.connector.Error as e:
            logger.error(f"Database error in job status email: {e}")
            return False
    
    def send_stock_alert(self, material_id: int, alert_type: str) -> bool:
        """Send stock level alert email"""
        if not self.db_manager.connect():
            return False
        
        try:
            cursor = self.db_manager.connection.cursor()
            cursor.execute("""
                SELECT material_name, material_type, current_stock, minimum_stock, reorder_point
                FROM materials
                WHERE material_id = %s
            """, (material_id,))
            
            material_data = cursor.fetchone()
            if not material_data:
                logger.error(f"Material {material_id} not found")
                return False
            
            material_name, material_type, current_stock, minimum_stock, reorder_point = material_data
            cursor.close()
            
            # Get company email from config
            cursor = self.db_manager.connection.cursor()
            cursor.execute("SELECT config_value FROM system_config WHERE config_key = 'company_email'")
            result = cursor.fetchone()
            company_email = result[0] if result else "admin@company.com"
            cursor.close()
            
            subject = f"Stock Alert: {material_name} - {alert_type.replace('_', ' ').title()}"
            
            alert_messages = {
                'low_stock': f'is running low. Current level: {current_stock}, Minimum: {minimum_stock}',
                'out_of_stock': 'is out of stock and needs immediate attention',
                'reorder_needed': f'has reached reorder point. Current: {current_stock}, Reorder at: {reorder_point}'
            }
            
            alert_message = alert_messages.get(alert_type, f'requires attention. Current stock: {current_stock}')
            
            body = f"""Stock Alert Notification

Material: {material_name}
Type: {material_type.replace('_', ' ').title()}
Alert: {alert_message}

Please review inventory levels and consider placing a reorder if necessary.

Current Stock Level: {current_stock}
Minimum Stock Level: {minimum_stock}
Reorder Point: {reorder_point}

Sent automatically by Sign Manufacturing System
"""
            
            email_msg = EmailMessage(
                to_email=company_email,
                subject=subject,
                body=body,
                email_type="stock_alert",
                related_to_type="material",
                related_to_id=material_id
            )
            
            return self.send_email(email_msg)
            
        except mysql.connector.Error as e:
            logger.error(f"Database error in stock alert email: {e}")
            return False

def main():
    """Test the email system"""
    email_system = EmailSystem()
    
    # Test email
    test_msg = EmailMessage(
        to_email="test@example.com",
        subject="Sign Manufacturing System - Email Test",
        body="This is a test email from the Sign Manufacturing Email System.",
        email_type="general"
    )
    
    success = email_system.send_email(test_msg)
    print(f"Test email {'sent successfully' if success else 'failed'}")

if __name__ == "__main__":
    main()