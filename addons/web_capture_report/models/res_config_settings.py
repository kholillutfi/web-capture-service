from odoo import models, fields, api
import logging
_logger = logging.getLogger(__name__)
import re
from odoo.exceptions import UserError

class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    web_capture_node_server = fields.Char('Node.js Server')
    web_capture_auth_username = fields.Char('Username')
    web_capture_auth_password = fields.Char('Password')

    @api.constrains('web_capture_node_server')
    def _check_web_capture_node_server(self):
        pattern = r'^((localhost)|(\d{1,3}(\.\d{1,3}){3})):\d{1,5}$'

        for rec in self:
            if rec.web_capture_node_server and not re.match(pattern, rec.web_capture_node_server):
                raise UserError(
                    "Invalid Node.js server format.\n"
                    "Use format: IP:PORT\n"
                    "Example: 192.168.xx.xx:3000 or localhost:3000"
                )

    def set_values(self):
        try:
            set_params = {
                'web.capture.node.server': self.web_capture_node_server,
                'web.capture.username': self.web_capture_auth_username,
                'web.capture.password': self.web_capture_auth_password,
            }
            for key, value in set_params.items():
                self.env['ir.config_parameter'].sudo().set_param(key, value)

        except Exception as err:
            _logger.info(err)

        return super(ResConfigSettings, self).set_values()
    
    @api.model
    def get_values(self):
        res = super(ResConfigSettings, self).get_values()
        try:
            ir_config = self.env['ir.config_parameter'].sudo()
            node_server_param = ir_config.get_param('web.capture.node.server')
            web_capture_username_param = ir_config.get_param('web.capture.username')
            web_capture_auth_password_param = ir_config.get_param('web.capture.password')

            res.update(
                web_capture_node_server = node_server_param if node_server_param else False,
                web_capture_auth_username = web_capture_username_param if web_capture_username_param else False,
                web_capture_auth_password = web_capture_auth_password_param if web_capture_auth_password_param else False,
            )

        except Exception as err:
            _logger.info(err)

        return res