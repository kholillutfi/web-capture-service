{
    'name': 'Gantt Capture Report Automated',
    'summary': 'Gantt Capture Report Automated',
    'version': '14.0',
    'category': 'Tools',
    'sequence': 60,
    'author': 'M. Kholil Lutfi S. Kom',
    'depends': ['base', 'web','web_capture_report'],
    'data': [
        'security/ir.model.access.csv',
        'data/ir_cron.xml',
        'data/mail_template.xml',
        'views/capture_report_automation_views.xml',
    ],
    'installable': True,
    'license': 'OEEL-1',
}
