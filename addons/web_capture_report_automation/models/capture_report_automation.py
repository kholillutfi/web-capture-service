from odoo import api, fields, models
from asyncio.log import logger


class WebCaptureReportAutomation(models.Model):
    _name = 'web.capture.report.automation'
    _description = 'Web Capture Report Automation'

    name = fields.Char('Name')
    date = fields.Date('Date')
    report_file = fields.Binary("Report File", attachment=True)
    report_view = fields.Binary("Report View", readonly=True)
    report_view_name = fields.Char("Report View Name", readonly=True)

    def report_send_mail(self):
        template_id = self.env.ref("web_capture_report_automation.email_template_for_gantt_chart_report")
        attachment_data = {
                            'name': f'{self.name}.pdf',
                            'type': 'binary',
                            'datas': self.report_file,
                            'store_fname': self.name,
                            'res_model': self._name,
                            'res_id': self.id,
                            'mimetype': 'application/pdf'
                        }

        email_values = {
                'attachment_ids': [(0,0, attachment_data)],
            }
        template_id.sudo().send_mail(self.id, force_send=True, email_values=email_values)

    

    
    



