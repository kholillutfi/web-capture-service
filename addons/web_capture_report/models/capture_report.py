from odoo import api, fields, models, _
from odoo.exceptions import UserError
from asyncio.log import logger
from odoo.http import request
import requests

import base64
from io import BytesIO
from PIL import Image
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
import re

class WebCaptureReport(models.Model):
    _name = 'web.capture.report'
    _description = 'Web Page Capture Report'

    name = fields.Char(string="Name", required=True)
    capture_url = fields.Char("Gantt View URL", required=True)
    screenshot_file = fields.Binary("Screenshot Result", readonly=True)
    screenshot_filename = fields.Char("Filename", readonly=True)
    viewport_width = fields.Integer(string="Width", default=1920, required=True)
    viewport_height = fields.Integer(string="Height", default=1080, required=True)

    fullpage = fields.Boolean('Full Page', default=True)
    crop_width = fields.Integer(string="Width", default=lambda self: self.viewport_width)
    crop_height = fields.Integer(string="Height", default=lambda self: self.viewport_height)
    crop_y = fields.Integer(string="Top")
    crop_x = fields.Integer(string="Right")

    convert_pdf = fields.Boolean("Convert to PDF")
    pdf_file = fields.Binary("PDF File", compute="_compute_pdf_file", store=True, attachment=True)

    @api.constrains('capture_url')
    def _check_capture_url(self):
        pattern = r'^(http|https)://[^\s/$.?#].[^\s]*$'

        for rec in self:
            if rec.capture_url and not re.match(pattern, rec.capture_url):
                raise UserError(
                    "Invalid URL format.\n"
                    "Example:\n"
                    "http://localhost:8014/web\n"
                    "https://odoo.com"
                )

    def action_capture(self):
        ir_config = self.env['ir.config_parameter'].sudo()
        node_server_address = ir_config.get_param('web.capture.node.server')
        auth_username = ir_config.get_param('web.capture.username')
        auth_password = ir_config.get_param('web.capture.password')
        
        configs = {
            'Node Server Address': node_server_address,
            'Username': auth_username,
            'Password': auth_password,
        }

        missing = [name for name, val in configs.items() if not val]

        if missing:
            raise UserError(_("Configuration is not complete: \n- " + "\n- ".join(missing)))

        try:
            resp = requests.post(f"http://{node_server_address}/capture",   
                json={
                    "url": self.capture_url, 
                    "username": auth_username,
                    "password": auth_password,
                    "viewport_width": self.viewport_width,
                    "viewport_height": self.viewport_height,
                    "fullpage": self.fullpage,
                    "crop_width": self.crop_width,
                    "crop_height": self.crop_height,
                    "crop_y": self.crop_y,
                    "crop_x": self.crop_x
                })
            resp.raise_for_status()
            data = resp.json()

            # get base64 string from Node.js API
            base64_img = data.get("screenshot_base64")
            filename = data.get("filename", "screenshot.png")
            self.screenshot_file = base64_img
            self.screenshot_filename = filename
        except Exception as Err:
            logger.info(Err)
            self.screenshot_file = False
            self.screenshot_filename = False
            raise UserError(_("Ensure the Node.js Server IP Address and Port are valid, the server is running, and the provided credentials are correct!"))
    
    @api.depends('screenshot_file')
    def _compute_pdf_file(self):
        for rec in self:
            if not rec.screenshot_file or not rec.convert_pdf:
                rec.pdf_file = False
                continue

            # Convert image → PDF
            rec.pdf_file = self._convert_image_to_pdf(rec.screenshot_file)

    def _convert_image_to_pdf(self, image_base64):
        # Decode gambar
        image_data = base64.b64decode(image_base64)
        image = Image.open(BytesIO(image_data))

        buffer = BytesIO()
        pdf = canvas.Canvas(buffer)

        width, height = image.size
        pdf.setPageSize((width, height))

        ## convert image ke buffer PNG
        img_buffer = BytesIO()
        image.save(img_buffer, format='PNG')
        img_buffer.seek(0)

        # gunakan ImageReader (solusi error BytesIO)
        img_reader = ImageReader(img_buffer)

        # gambar ke PDF
        pdf.drawImage(img_reader, 0, 0, width=width, height=height)

        pdf.save()
        pdf_data = buffer.getvalue()

        return base64.b64encode(pdf_data)
    
    @api.model
    def default_get(self, fields):
        res = super(WebCaptureReport, self).default_get(fields)
        page_width = res.get('viewport_width')
        page_height = res.get('viewport_height')

        res['crop_width'] = page_width
        res['crop_height'] = page_height

        return res