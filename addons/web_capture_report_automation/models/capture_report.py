from odoo import api, fields, models, _
from asyncio.log import logger
from odoo.exceptions import UserError
import calendar
from datetime import datetime

class WebCaptureReport(models.Model):
    _inherit = 'web.capture.report'

    # def create_capture_report_to_mail(self, day='Monday', record_id=0):
    def create_capture_report_to_mail(self, record_id=0):
        if not record_id:
            raise UserError('Id kosong')

        # day_list = list(calendar.day_name)
        # if day not in day_list:
        #     raise UserError(f'hari {day} tidak ada!')
        
        capture_id = self.env[self._name].browse(record_id)
        if not capture_id.convert_pdf:
            raise UserError('Report Web harus di convert pdf dulu!')

        current_date = datetime.today()
        # current_day = current_date.strftime('%A')
        # if day != current_day:
        #     return

        capture_id.action_capture()
        report_automation_id = self.env['web.capture.report.automation'].create({
                'date': current_date, 
                'name': f"{capture_id.name} - {current_date.strftime('%d/%m/%Y')}", 
                'report_file': capture_id.pdf_file,
                'report_view': capture_id.screenshot_file,
                'report_view_name': capture_id.screenshot_filename,

            })
        report_automation_id.report_send_mail()
