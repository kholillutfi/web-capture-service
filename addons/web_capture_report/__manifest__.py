{
    'name': 'Web Capture',
    'summary': 'Gantt Capture Report',
    'version': '14.0',
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
