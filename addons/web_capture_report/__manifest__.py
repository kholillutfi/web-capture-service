{
    'name': 'Web Capture',
    'summary': 'Capture Odoo web pages as screenshots or PDF files',
    'description': """
Odoo Web Capture is an Odoo module that allows users to capture Odoo web pages as screenshots or PDF files using a Node.js capture server.

This module is designed for visual reporting and web page capture automation inside Odoo. It can be used to capture dashboards, Gantt views, list views, form views, accounting dashboards, manufacturing reports, and other Odoo pages that need to be saved or shared as visual reports.

Main Features:
- Capture Odoo pages by URL
- Capture pages directly from Odoo form using the Capture Now button
- Support screenshot preview result
- Support PDF conversion
- Store generated PDF as an attachment
- Support full page capture
- Support custom page resolution
- Support crop capture area
- Configure Node.js capture server from Odoo settings
- Support capture server authentication using username and password
- Suitable for manual reporting and automated report generation

This module is useful for companies that need to generate visual reports from Odoo pages without manually taking screenshots from the browser.
""",
    'version': '14.1.0',
    'category': 'Tools',
    'sequence': 50,
    'author': 'M. Kholil Lutfi S. Kom',
    'depends': ['base', 'web'],
    'data': [
        'security/ir.model.access.csv',
        'data/ir_config_parameter.xml',
        'views/capture_report_views.xml',
        'views/res_config_settings_views.xml',
        'views/menu_views.xml'
    ],
    'installable': True,
    'license': 'OEEL-1',
}
