import '@servicenow/sdk/global'

declare global {
    namespace Now {
        namespace Internal {
            interface Keys extends KeysRegistry {
                explicit: {
                    'app.css': {
                        table: 'sys_ux_theme_asset'
                        id: '442f52399a264f8fa2f94b588a27ed1b'
                        deleted: true
                    }
                    'app.menu': {
                        table: 'sys_app_application'
                        id: '1c8d6f988dec473b852e3f531ad12353'
                    }
                    bom_json: {
                        table: 'sys_module'
                        id: 'beafdf547cd5432e9c680383ecd02ada'
                    }
                    'brv-page': {
                        table: 'sys_ui_page'
                        id: '0407df0d1c504e7e843237ab16b31672'
                    }
                    'module.visualizer': {
                        table: 'sys_app_module'
                        id: '74ff14390719416e8a3ef7b9bcc15442'
                    }
                    'node_modules/@mantine/core/styles.css': {
                        table: 'sys_ux_theme_asset'
                        id: 'e3b94dfdb0b242b58efb181d52532b59'
                    }
                    package_json: {
                        table: 'sys_module'
                        id: '2dc2cceb7cca4cb5baf6731ddc33b002'
                    }
                    'si.business_rule_service': {
                        table: 'sys_script_include'
                        id: 'adcd2586f6704c598d38e41dfc704e5f'
                    }
                    'si.user_visualizer_service': {
                        table: 'sys_script_include'
                        id: '26153e8469554b50bfba6a1fc18dd5b5'
                    }
                    'x_1118332_brv/main': {
                        table: 'sys_ux_lib_asset'
                        id: '21ab608f334f4bbdabc778afa0218be1'
                    }
                    'x_1118332_brv/main.js.map': {
                        table: 'sys_ux_lib_asset'
                        id: 'ae67dbdbc61241b1a2c873314fde305d'
                    }
                }
            }
        }
    }
}
