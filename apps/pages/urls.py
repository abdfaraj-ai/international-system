from django.urls import path
from . import views
from .api import flutter      as api_views
from .api import portal       as portal_api
from .api import portal_chat  as portal_chat_api
from .api import auth_api     as auth_api
from .api import dashboard    as dashboard_api
from .api import transactions as transactions_api
from .api import accounts     as accounts_api
from .api import teller       as teller_api
from .api import supervisor   as supervisor_api
from .api import health       as health_api
from .api import agent        as agent_api
from .api import print_receipt as print_api
from .api import totp          as totp_api
from .api import support       as support_api
from .api import tasks         as tasks_api
from .api import admin_voice   as admin_voice_api
from .api import attendance    as attendance_api
from .api import daily_report   as daily_report_api
from .api import accountant_report as accountant_report_api
from .api import agent_portal  as agent_portal_api
from .api import whatsapp      as wa_api
from .api import voice_cmd     as voice_cmd_api
from .api import fx_rates      as fx_rates_api
from .api import am_transfers  as am_api
from .api import am_exchange   as am_ex_api
from .api import am_cut        as am_cut_api
from .api import am_journal    as am_jrn_api
from .api import am_settlement as am_stl_api
from .api import am_adv_entry  as am_adv_api
from .api import am_statement       as am_stm_api
from .api import am_entry_from_to  as am_eft_api
from .api import am_opening_entry   as am_oe_api
from .api import am_receipt_voucher  as am_rv_api
from .api import am_payment_voucher   as am_pv_api
from .api import am_currency_exchange  as am_cx_api
from .api import am_outgoing_transfer  as am_ot_api
from .api import am_new_credit         as am_nc_api
from .api import am_trial_balance      as am_tb_api
from .api import am_center_profits     as am_cp_api
from .api import am_cost_center        as am_cc_api
from .api import am_customers           as am_cust_api
from .api import am_cut_prices         as am_ctp_api
from .api import am_cut_distribution   as am_cdist_api
from .api import am_currencies         as am_currencies_api
from .api import am_audit_log          as am_audit_log_api
from .api import am_center_ledger      as am_cl_api

urlpatterns = [
    # ── Client Portal — بوابة العملاء ───────────────────────────────────────────
    path('portal/',                           views.portal_view,             name='portal'),
    path('portal/verify/<str:token>/',        views.portal_verify_view,      name='portal-verify'),
    path('api/portal/google-auth/',           portal_api.api_portal_google_auth,    name='api-portal-google'),
    path('api/portal/request-access/',        portal_api.api_portal_request_access, name='api-portal-request'),
    path('api/portal/session/',               portal_api.api_portal_session,        name='api-portal-session'),
    path('api/portal/logout/',                portal_api.api_portal_logout,         name='api-portal-logout'),
    path('api/portal/config/',                portal_api.api_portal_config,         name='api-portal-config'),
    path('api/portal/submit/',                portal_api.api_portal_submit,         name='api-portal-submit'),
    path('api/portal/chat/',                  portal_chat_api.api_portal_chat,      name='api-portal-chat'),
    path('api/portal/track/',                 portal_api.api_portal_track,          name='api-portal-track'),

    # ── إدارة البوابة — مشرف التلر (M02 / M01) ──────────────────────────────────
    path('api/sv/portal/countries',                          portal_api.api_sv_portal_countries,      name='api-sv-portal-countries'),
    path('api/sv/portal/countries/<slug:slug>',              portal_api.api_sv_portal_country_detail, name='api-sv-portal-country-detail'),
    path('api/sv/portal/countries/<slug:slug>/methods',      portal_api.api_sv_portal_methods,        name='api-sv-portal-methods'),
    path('api/sv/portal/methods/<int:method_id>',            portal_api.api_sv_portal_method_detail,  name='api-sv-portal-method-detail'),

    # ── Health Check ─────────────────────────────────────────────────────────────
    path('api/health/',                health_api.api_health,              name='api-health'),

    # ── FX Rates — شريط أسعار العملات ────────────────────────────────────────────
    path('api/fx-rates/',              fx_rates_api.api_fx_rates,          name='api-fx-rates'),

    # ── Flutter Auth ─────────────────────────────────────────────────────────────
    path('api/auth/login/',            auth_api.api_login,                 name='api-flutter-login'),
    path('api/auth/me/',               auth_api.api_me,                    name='api-flutter-me'),
    path('api/auth/logout/',           auth_api.api_logout,                name='api-flutter-logout'),

    # Auth
    path('',                           views.login_view,                   name='login'),
    path('login/',                     views.login_view,                   name='login-alt'),
    path('logout/',                    views.logout_view,                  name='logout'),
    path('api/login/',                 views.api_login,                    name='api-login'),
    path('api/forgot-password/',       views.api_forgot_password,          name='api-forgot-password'),
    path('api/reset-password/',        views.api_reset_password,           name='api-reset-password'),
    path('reset-password/',            views.api_reset_password,           name='reset-password'),
    path('api/impersonate/',           views.api_impersonate,              name='api-impersonate'),
    path('api/me/',                    views.api_me,                       name='api-me'),

    # ── التقرير اليومي (E01) ─────────────────────────────────────────────────
    path('daily-report/',              views.daily_report_view,            name='daily-report'),
    path('daily-reports/admin/',       views.daily_reports_admin_view,     name='daily-reports-admin'),
    path('api/daily-report/submit/',          daily_report_api.api_submit_report,  name='api-dr-submit'),
    path('api/daily-report/my/',              daily_report_api.api_my_reports,     name='api-dr-my'),
    path('api/daily-report/all/',             daily_report_api.api_all_reports,    name='api-dr-all'),
    path('api/daily-report/stats/',           daily_report_api.api_reports_stats,  name='api-dr-stats'),
    path('api/daily-report/<int:report_id>/review/', daily_report_api.api_review_report, name='api-dr-review'),

    # ── تقرير المحاسب (E01 + accountant) ─────────────────────────────────────
    path('accountant-report/',         views.accountant_report_view,       name='accountant-report'),
    path('api/accountant-report/submit/',         accountant_report_api.api_submit,  name='api-acc-submit'),
    path('api/accountant-report/my/',             accountant_report_api.api_my,      name='api-acc-my'),
    path('api/accountant-report/all/',            accountant_report_api.api_all,     name='api-acc-all'),
    path('api/accountant-report/<int:report_id>/review/', accountant_report_api.api_review, name='api-acc-review'),

    # ── 2FA (Google Authenticator) ───────────────────────────────────────────
    path('api/2fa/setup/',             totp_api.api_2fa_setup,             name='api-2fa-setup'),
    path('api/2fa/confirm/',           totp_api.api_2fa_confirm,           name='api-2fa-confirm'),
    path('api/2fa/verify/',            totp_api.api_2fa_verify,            name='api-2fa-verify'),
    path('api/2fa/disable/',           totp_api.api_2fa_disable,           name='api-2fa-disable'),
    path('api/2fa/status/',            totp_api.api_2fa_status,            name='api-2fa-status'),
    path('api/support/',               support_api.api_support,            name='api-support'),

    # ── نظام المهام الداخلي ──────────────────────────────────────────────────
    path('api/tasks/',                          tasks_api.api_task_list,       name='api-task-list'),
    path('api/tasks/create/',                   tasks_api.api_task_create,     name='api-task-create'),
    path('api/tasks/stats/',                    tasks_api.api_task_stats,      name='api-task-stats'),
    path('api/tasks/assignees/',                tasks_api.api_task_assignees,  name='api-task-assignees'),
    path('api/tasks/<int:task_id>/',            tasks_api.api_task_detail,     name='api-task-detail'),
    path('api/tasks/<int:task_id>/submit/',              tasks_api.api_task_submit,             name='api-task-submit'),
    path('api/tasks/<int:task_id>/comment/',             tasks_api.api_task_comment,            name='api-task-comment'),
    path('api/tasks/developers/',                        tasks_api.api_task_developers,         name='api-task-developers'),
    path('api/tasks/developers/<str:username>/',         tasks_api.api_task_developer_detail,   name='api-task-developer-detail'),
    path('api/tasks/developers/<str:username>/password/',tasks_api.api_task_developer_password, name='api-task-developer-password'),

    # ── إدارة الحسابات — API ─────────────────────────────────────────────────────
    path('api/am/init/',                          am_api.api_am_init,              name='api-am-init'),
    path('api/am/transfers/',                     am_api.api_am_transfers,         name='api-am-transfers'),
    path('api/am/transfers/<int:transfer_id>/receive/', am_api.api_am_transfer_receive, name='api-am-transfer-receive'),
    path('api/delivery-moves/',                  am_api.api_delivery_moves,       name='api-delivery-moves'),
    path('api/am/exchange/',              am_ex_api.api_am_exchange,   name='api-am-exchange'),
    path('api/am/cut/',                   am_cut_api.api_am_cut,        name='api-am-cut'),
    path('api/am/cut/<int:cut_id>/',      am_cut_api.api_am_cut_detail, name='api-am-cut-detail'),

    # ── دليل الحسابات والقيود المحاسبية ─────────────────────────────────────────
    path('api/am/accounts/',                   am_jrn_api.api_am_accounts,         name='api-am-accounts'),
    path('api/am/accounts/<int:account_id>/',  am_jrn_api.api_am_account_detail,   name='api-am-account-detail'),
    path('api/am/journal/',                    am_jrn_api.api_am_journal,          name='api-am-journal'),
    path('api/am/journal/<int:journal_id>/',   am_jrn_api.api_am_journal_detail,   name='api-am-journal-detail'),

    # ── قيود التسوية ─────────────────────────────────────────────────────────────
    path('api/am/settlement/',                  am_stl_api.api_am_settlement,        name='api-am-settlement'),
    path('api/am/settlement/<int:voucher_id>/', am_stl_api.api_am_settlement_detail, name='api-am-settlement-detail'),

    # ── القيود المتقدمة ───────────────────────────────────────────────────────────
    path('api/am/adv-entry/',                   am_adv_api.api_am_adv_entry,         name='api-am-adv-entry'),
    path('api/am/adv-entry/<int:entry_id>/',    am_adv_api.api_am_adv_entry_detail,  name='api-am-adv-entry-detail'),

    path('api/am/entry-from-to/',                    am_eft_api.api_am_entry_from_to,        name='api-am-entry-from-to'),
    path('api/am/entry-from-to/<int:entry_id>/',     am_eft_api.api_am_entry_from_to_detail, name='api-am-entry-from-to-detail'),

    path('accounting/advanced-entry/',               views.am_advanced_entry_view,            name='am-advanced-entry'),
    path('accounting/settlement-move/',              views.am_settlement_move_view,           name='am-settlement-move'),
    path('accounting/opening-entry/',                views.am_opening_entry_view,             name='am-opening-entry'),
    path('accounting/receipt-voucher/',              views.am_receipt_voucher_view,           name='am-receipt-voucher'),

    path('api/am/opening-entry/',                    am_oe_api.api_am_opening_entry,          name='api-am-opening-entry'),
    path('api/am/opening-entry/<int:entry_id>/',     am_oe_api.api_am_opening_entry_detail,   name='api-am-opening-entry-detail'),

    path('api/am/receipt-voucher/',                  am_rv_api.api_am_receipt_voucher,        name='api-am-receipt-voucher'),
    path('api/am/receipt-voucher/<int:voucher_id>/', am_rv_api.api_am_receipt_voucher_detail, name='api-am-receipt-voucher-detail'),

    path('accounting/payment-voucher/',              views.am_payment_voucher_view,              name='am-payment-voucher'),
    path('api/am/payment-voucher/',                  am_pv_api.api_am_payment_voucher,           name='api-am-payment-voucher'),
    path('api/am/payment-voucher/<int:voucher_id>/', am_pv_api.api_am_payment_voucher_detail,    name='api-am-payment-voucher-detail'),

    path('accounting/exchange/',                     views.am_currency_exchange_view,            name='am-currency-exchange'),
    path('api/am/currency-exchange/',                am_cx_api.api_am_currency_exchange,         name='api-am-currency-exchange'),
    path('api/am/currency-exchange/<int:record_id>/',am_cx_api.api_am_currency_exchange_detail,  name='api-am-currency-exchange-detail'),

    path('accounting/outgoing-move/',                       views.am_outgoing_transfer_view,                name='am-outgoing-move'),
    path('api/am/outgoing-transfer/',                       am_ot_api.api_am_outgoing_transfer,             name='api-am-outgoing-transfer'),
    path('api/am/outgoing-transfer/<int:record_id>/',       am_ot_api.api_am_outgoing_transfer_detail,      name='api-am-outgoing-transfer-detail'),

    path('accounting/new-credit/',                          views.am_new_credit_view,                       name='am-new-credit'),
    path('api/am/new-credit/',                              am_nc_api.api_am_new_credit,                    name='api-am-new-credit'),
    path('api/am/new-credit/<int:record_id>/',              am_nc_api.api_am_new_credit_detail,             name='api-am-new-credit-detail'),

    path('accounting/ops-monitor/',                         views.am_ops_monitor_view,                      name='am-ops-monitor'),
    path('accounting/entry-audit/',                         views.am_entry_audit_view,                      name='am-entry-audit'),
    path('accounting/trial-balance/',                       views.am_trial_balance_view,                    name='am-trial-balance'),
    path('api/am/trial-balance/',                           am_tb_api.api_am_trial_balance,                 name='api-am-trial-balance'),

    # ── كشف الحساب ───────────────────────────────────────────────────────────────
    path('api/am/statement/',          am_stm_api.api_am_statement,         name='api-am-statement'),
    path('api/am/statement/centers/',  am_stm_api.api_am_statement_centers, name='api-am-statement-centers'),

    # Pages
    path('dashboard/',                 views.dashboard_view,               name='dashboard'),
    path('accounts/',                  views.accounts_view,                name='accounts'),
    path('accounts/manage/',           views.accounts_manage_view,         name='accounts-manage'),
    path('system/users/',              views.users_manage_view,             name='users-manage'),
    path('system/permissions/',        views.permissions_manage_view,       name='permissions-manage'),
    path('teller/',                    views.teller_departments_view,      name='teller-departments'),
    path('supervisor/teller/',         views.teller_supervisor_view,       name='teller-supervisor'),
    path('transactions/',              views.transactions_view,            name='transactions'),
    path('transactions/supervisor/',   views.transactions_supervisor_view, name='transactions-supervisor'),
    path('agents/',                    views.agent_dashboard_view,         name='agent-dashboard'),
    path('tasks/admin/',               views.tasks_admin_view,             name='tasks-admin'),
    path('tasks/my/',                  views.tasks_developer_view,         name='tasks-developer'),

    # ── Flutter App API ───────────────────────────────────────────────────────
    path('api/rates',          api_views.api_rates,          name='api-rates'),
    path('api/transcribe',     api_views.api_transcribe,     name='api-transcribe'),
    path('api/exchange',       api_views.api_exchange,       name='api-exchange'),
    path('api/last-exchange',  api_views.api_last_exchange,  name='api-last-exchange'),
    path('api/upload-image',   api_views.api_upload_image,   name='api-upload-image'),
    path('api/voice-teller',       api_views.api_voice_teller,       name='api-voice-teller'),
    path('api/voice-execute',      api_views.api_voice_execute,      name='api-voice-execute'),
    path('api/voice-rates',        api_views.api_voice_rates,        name='api-voice-rates'),
    path('api/pending-operation',  api_views.api_pending_operation,  name='api-pending-operation'),
    path('api/ocr',                api_views.api_ocr,                name='api-ocr'),

    # ── أسعار الصرف — مشرف التلر ─────────────────────────────────────────────
    path('api/sv/rates',           api_views.api_sv_rates,           name='api-sv-rates'),

    # ── طلبات التلرات ─────────────────────────────────────────────────────────
    path('api/teller/requests',                       api_views.api_teller_requests,       name='api-teller-requests'),
    path('api/teller/requests/<str:request_id>',      api_views.api_teller_request_detail, name='api-teller-request-detail'),

    # ── أرصدة الصناديق ────────────────────────────────────────────────────────
    path('api/sv/balances',                           api_views.api_sv_balances,           name='api-sv-balances'),

    # ── قائمة التلرات ─────────────────────────────────────────────────────────
    path('api/sv/tellers',                            api_views.api_sv_tellers,            name='api-sv-tellers'),
    path('api/sv/tellers/<str:username>',             api_views.api_sv_teller_detail,      name='api-sv-teller-detail'),
    path('api/sv/tellers/<str:username>/password',    api_views.api_sv_teller_password,    name='api-sv-teller-password'),

    # ── صلاحيات التلرات ───────────────────────────────────────────────────────
    path('api/sv/permissions',                        api_views.api_sv_permissions,        name='api-sv-permissions'),
    path('api/sv/permissions/<str:username>',         api_views.api_sv_permission_detail,  name='api-sv-permission-detail'),

    # ══════════════════════════════════════════════════════════════════════════
    # Dashboard APIs — الإدارة العامة
    # ══════════════════════════════════════════════════════════════════════════

    # ── إحصائيات وهيكل ─────────────────────────────────────────────────────
    path('api/dash/stats',              dashboard_api.api_dash_stats,          name='api-dash-stats'),
    path('api/dash/org-tree',           dashboard_api.api_org_tree,            name='api-org-tree'),

    # ── الفروع ──────────────────────────────────────────────────────────────
    path('api/branches',                    dashboard_api.api_branches,            name='api-branches'),
    path('api/branches/transfer',           dashboard_api.api_branch_transfer,     name='api-branch-transfer'),
    path('api/branches/<int:branch_id>',    dashboard_api.api_branch_detail,       name='api-branch-detail'),
    path('api/branches/<int:branch_id>/transfers', dashboard_api.api_branch_transfers, name='api-branch-transfers'),

    # ── المشرفون ────────────────────────────────────────────────────────────
    path('api/supervisors',                      dashboard_api.api_supervisors,         name='api-supervisors'),
    path('api/supervisors/<str:username>',        dashboard_api.api_supervisor_detail,   name='api-supervisor-detail'),

    # ── المستخدمون ──────────────────────────────────────────────────────────
    path('api/users',                            dashboard_api.api_users,               name='api-users'),
    path('api/users/<str:username>',             dashboard_api.api_user_detail,         name='api-user-detail'),
    path('api/users/<str:username>/password',    dashboard_api.api_user_password,       name='api-user-password'),

    # ── العمليات الموحدة ─────────────────────────────────────────────────────
    path('api/transactions-unified',             dashboard_api.api_transactions_unified, name='api-transactions-unified'),

    # ── الخزينة المركزية ─────────────────────────────────────────────────────
    path('api/main-box',                         dashboard_api.api_main_box,              name='api-main-box'),
    path('api/main-box/deposit',                 dashboard_api.api_main_box_deposit,      name='api-main-box-deposit'),
    path('api/main-box/distribute',              dashboard_api.api_main_box_distribute,   name='api-main-box-distribute'),
    path('api/main-box/end-of-day',              dashboard_api.api_main_box_end_of_day,   name='api-main-box-end-of-day'),

    # ── صناديق المشرفين (الإدارة) ────────────────────────────────────────────
    path('api/supervisor-boxes',                         dashboard_api.api_supervisor_boxes,       name='api-supervisor-boxes'),
    path('api/supervisor-boxes/deposit',                 dashboard_api.api_supervisor_box_deposit, name='api-supervisor-box-deposit'),
    path('api/supervisor-boxes/<str:username>/log',      dashboard_api.api_supervisor_box_log,     name='api-supervisor-box-log'),

    # ── الجلسات النشطة ────────────────────────────────────────────────────────
    path('api/sessions',                         dashboard_api.api_sessions,            name='api-sessions'),

    # ══════════════════════════════════════════════════════════════════════════
    # Transactions APIs — مشرف الحوالات (M03) + موظف الحوالات (T03)
    # ══════════════════════════════════════════════════════════════════════════

    # ── إحصائيات ─────────────────────────────────────────────────────────────
    path('api/ts/stats',                                    transactions_api.api_ts_stats,              name='api-ts-stats'),

    # ── طلبات بوابة العملاء ────────────────────────────────────────────────────
    path('api/ts/portal-requests/',                         portal_api.api_ts_portal_requests,          name='api-ts-portal-requests'),
    path('api/ts/portal-requests/<int:req_id>/',            portal_api.api_ts_portal_request_detail,    name='api-ts-portal-request-detail'),
    path('api/portal-requests/<int:req_id>/forward/',       portal_api.api_portal_forward,              name='api-portal-forward'),
    path('api/my-portal-receipts/',                         portal_api.api_my_portal_receipts,          name='api-my-portal-receipts'),

    # ── الحوالات ──────────────────────────────────────────────────────────────
    path('api/ts/transfers',                                transactions_api.api_ts_transfers,          name='api-ts-transfers'),
    path('api/ts/transfers/<int:transfer_id>',              transactions_api.api_ts_transfer_detail,    name='api-ts-transfer-detail'),
    path('api/ts/my-transfers',                             transactions_api.api_ts_my_transfers,       name='api-ts-my-transfers'),

    # ── الموظفون ──────────────────────────────────────────────────────────────
    path('api/ts/employees',                                transactions_api.api_ts_employees,          name='api-ts-employees'),
    path('api/ts/employees/<str:username>',                 transactions_api.api_ts_employee_detail,    name='api-ts-employee-detail'),
    path('api/ts/employees/<str:username>/password',        transactions_api.api_ts_employee_password,  name='api-ts-employee-password'),

    # ── وكلاء التنفيذ ─────────────────────────────────────────────────────────
    path('api/ts/agents',                                                   transactions_api.api_ts_agents,               name='api-ts-agents'),
    path('api/ts/agents/',                                                  transactions_api.api_ts_agents,               name='api-ts-agents-slash'),
    path('api/ts/agents/<int:agent_id>',                                    transactions_api.api_ts_agent_detail,         name='api-ts-agent-detail'),
    path('api/ts/agents/<int:agent_id>/',                                   transactions_api.api_ts_agent_detail,         name='api-ts-agent-detail-slash'),
    path('api/ts/agents/<int:agent_id>/portal-setup/',                      transactions_api.api_ts_agent_portal_setup,   name='api-ts-agent-portal-setup'),
    path('api/ts/agents/<int:agent_id>/locations/',                         transactions_api.api_ts_agent_locations,      name='api-ts-agent-locations'),
    path('api/ts/agents/<int:agent_id>/locations/<int:loc_id>/',            transactions_api.api_ts_agent_location_detail,name='api-ts-agent-location-detail'),
    path('api/ts/agents/<int:agent_id>/rates/',                             transactions_api.api_ts_agent_rates,          name='api-ts-agent-rates'),
    path('api/ts/agents/<int:agent_id>/rates/<int:rate_id>/',               transactions_api.api_ts_agent_rate_detail,    name='api-ts-agent-rate-detail'),
    path('api/ts/agent-rates/',                                             transactions_api.api_ts_all_agent_rates,      name='api-ts-all-agent-rates'),

    # ── تكامل HawalaNet Pro — لوحة الوكيل ────────────────────────────────────
    path('api/agents/<int:agent_id>/dashboard',
         agent_api.api_agent_dashboard,              name='api-agent-dashboard'),
    path('api/agents/<int:agent_id>/transfers',
         agent_api.api_agent_transfers,              name='api-agent-transfers'),
    path('api/agents/<int:agent_id>/transfers/<int:transfer_id>/confirm',
         agent_api.api_agent_confirm_transfer,       name='api-agent-confirm'),
    path('api/agents/<int:agent_id>/balance/deposit',
         agent_api.api_agent_deposit,                name='api-agent-deposit'),
    path('api/agents/<int:agent_id>/balance/history',
         agent_api.api_agent_balance_history,        name='api-agent-balance-history'),
    path('api/agents/<int:agent_id>/receipts/<int:receipt_id>/verify',
         agent_api.api_agent_verify_receipt,         name='api-agent-verify-receipt'),

    # ── مجموعات العملاء ───────────────────────────────────────────────────────
    path('api/ts/client-groups',                            transactions_api.api_ts_client_groups,      name='api-ts-client-groups'),
    path('api/ts/client-groups/<int:group_id>',             transactions_api.api_ts_client_group_detail, name='api-ts-client-group-detail'),

    # ── التقارير والتعليمات ───────────────────────────────────────────────────
    path('api/reports',                                     transactions_api.api_reports,               name='api-reports'),
    path('api/reports/<int:report_id>/read',                transactions_api.api_report_read,           name='api-report-read'),
    path('api/instructions',                                transactions_api.api_instructions,          name='api-instructions'),
    path('api/instructions/<int:instr_id>/read',            transactions_api.api_instruction_read,      name='api-instruction-read'),

    # ══════════════════════════════════════════════════════════════════════════
    # Accounts APIs — موظف التحويل البنكي (T02)
    # ══════════════════════════════════════════════════════════════════════════

    # ── إحصائيات ─────────────────────────────────────────────────────────────
    path('api/bk/stats',                                    accounts_api.api_bk_stats,                  name='api-bk-stats'),

    # ── التحويلات البنكية ─────────────────────────────────────────────────────
    path('api/bk/transfers',                                accounts_api.api_bk_transfers,              name='api-bk-transfers'),
    path('api/bk/transfers/<int:transfer_id>',              accounts_api.api_bk_transfer_detail,        name='api-bk-transfer-detail'),
    path('api/bk/transfers/<int:transfer_id>/complete',     accounts_api.api_bk_transfer_complete,      name='api-bk-transfer-complete'),
    path('api/bk/transfers/<int:transfer_id>/reject',       accounts_api.api_bk_transfer_reject,        name='api-bk-transfer-reject'),
    path('api/bk/transfers/<int:transfer_id>/status',       accounts_api.api_bk_transfer_status,        name='api-bk-transfer-status'),

    # ── التقارير والتعليمات ───────────────────────────────────────────────────
    path('api/bk/reports',                                  accounts_api.api_bk_reports,                name='api-bk-reports'),
    path('api/bk/instructions',                             accounts_api.api_bk_instructions,           name='api-bk-instructions'),
    path('api/bk/instructions/<int:instr_id>/read',         accounts_api.api_bk_instruction_read,       name='api-bk-instruction-read'),

    # ══════════════════════════════════════════════════════════════════════════
    # Teller APIs — موظف التلر (T01)
    # ══════════════════════════════════════════════════════════════════════════

    # ── إحصائيات ورصيد ───────────────────────────────────────────────────────
    path('api/tl/stats',                                    teller_api.api_tl_stats,                    name='api-tl-stats'),
    path('api/tl/balance',                                  teller_api.api_tl_balance,                  name='api-tl-balance'),
    path('api/tl/rates',                                    teller_api.api_tl_rates,                    name='api-tl-rates'),
    path('api/tl/session',                                  teller_api.api_tl_session,                  name='api-tl-session'),
    path('api/tl/session/open',                             teller_api.api_tl_session_open,             name='api-tl-session-open'),
    path('api/tl/session/close',                            teller_api.api_tl_session_close,            name='api-tl-session-close'),
    path('api/tl/notify',                                   teller_api.api_tl_notify,                   name='api-tl-notify'),

    # ── عمليات الصرافة ────────────────────────────────────────────────────────
    path('api/tl/exchange',                                 teller_api.api_tl_exchange,                 name='api-tl-exchange'),

    # ── الحوالات الدولية ──────────────────────────────────────────────────────
    path('api/tl/hawala',                                   teller_api.api_tl_hawala,                   name='api-tl-hawala'),
    path('api/tl/hawala/<int:op_id>',                       teller_api.api_tl_hawala_detail,            name='api-tl-hawala-detail'),

    # ── معاملات نقدية ─────────────────────────────────────────────────────────
    path('api/tl/cash',                                     teller_api.api_tl_cash,                     name='api-tl-cash'),

    # ── طلبات للمشرف ──────────────────────────────────────────────────────────
    path('api/tl/requests',                                 teller_api.api_tl_requests,                 name='api-tl-requests'),

    # ── التقارير ──────────────────────────────────────────────────────────────
    path('api/tl/reports',                                  teller_api.api_tl_reports,                  name='api-tl-reports'),

    # ══════════════════════════════════════════════════════════════════════════
    # Supervisor APIs — مشرف التلر (M02)
    # ══════════════════════════════════════════════════════════════════════════

    # ── إحصائيات ─────────────────────────────────────────────────────────────
    path('api/sv2/stats',                                   supervisor_api.api_sv2_stats,               name='api-sv2-stats'),

    # ── أسعار الصرف ───────────────────────────────────────────────────────────
    path('api/sv2/rates',                                   supervisor_api.api_sv2_rates,               name='api-sv2-rates'),

    # ── أرصدة الصناديق ────────────────────────────────────────────────────────
    path('api/sv2/balances',                                supervisor_api.api_sv2_balances,            name='api-sv2-balances'),

    # ── صندوق المشرف الخاص ───────────────────────────────────────────────────
    path('api/sv2/my-box',                                  supervisor_api.api_sv2_my_box,              name='api-sv2-my-box'),
    path('api/sv2/my-box/distribute',                       supervisor_api.api_sv2_box_distribute,      name='api-sv2-box-distribute'),
    path('api/sv2/my-box/reclaim',                          supervisor_api.api_sv2_box_reclaim,         name='api-sv2-box-reclaim'),
    path('api/sv2/my-box/log',                              supervisor_api.api_sv2_box_log,             name='api-sv2-box-log'),

    # ── قائمة التلرات ─────────────────────────────────────────────────────────
    path('api/sv2/tellers',                                 supervisor_api.api_sv2_tellers,             name='api-sv2-tellers'),
    path('api/sv2/tellers/<str:username>',                  supervisor_api.api_sv2_teller_detail,       name='api-sv2-teller-detail'),
    path('api/sv2/tellers/<str:username>/password',         supervisor_api.api_sv2_teller_password,     name='api-sv2-teller-password'),

    # ── صلاحيات التلرات ───────────────────────────────────────────────────────
    path('api/sv2/permissions',                             supervisor_api.api_sv2_permissions,         name='api-sv2-permissions'),
    path('api/sv2/permissions/<str:username>',              supervisor_api.api_sv2_permission_detail,   name='api-sv2-permission-detail'),

    # ── طلبات التلرات ─────────────────────────────────────────────────────────
    path('api/sv2/requests',                                supervisor_api.api_sv2_requests,            name='api-sv2-requests'),
    path('api/sv2/requests/<str:request_id>',               supervisor_api.api_sv2_request_detail,      name='api-sv2-request-detail'),

    # ── سجل العمليات ──────────────────────────────────────────────────────────
    path('api/sv2/operations',                              supervisor_api.api_sv2_operations,          name='api-sv2-operations'),

    # ── التقارير ──────────────────────────────────────────────────────────────
    path('api/sv2/reports',                                 supervisor_api.api_sv2_reports,             name='api-sv2-reports'),

    # ── التعليمات الإدارية ────────────────────────────────────────────────────
    path('api/sv2/instructions',                            supervisor_api.api_sv2_instructions,        name='api-sv2-instructions'),
    path('api/sv2/instructions/<int:instr_id>/read',        supervisor_api.api_sv2_instruction_read,    name='api-sv2-instruction-read'),

    # ── إحصائيات موظف الحوالات ───────────────────────────────────────────────
    path('api/ts/my-stats',                                 transactions_api.api_ts_my_stats,           name='api-ts-my-stats'),

    # ── تسعيرة البوابة — عمولة الدول (M03 / M01) ─────────────────────────
    path('api/ts/portal-pricing',                           transactions_api.api_ts_portal_pricing,        name='api-ts-portal-pricing'),
    path('api/ts/portal-pricing/<str:slug>',                transactions_api.api_ts_portal_pricing_detail, name='api-ts-portal-pricing-detail'),

    # ── الصوت الإداري — الإدارة العامة (M01 / IM01) ─────────────────────────
    path('api/admin/voice/',                                admin_voice_api.api_admin_voice,            name='api-admin-voice'),

    # ── مسح البيانات الوهمية (M01 فقط) ───────────────────────────────────────
    path('api/admin/clear-dummy-data',                      dashboard_api.api_clear_dummy_data,         name='api-clear-dummy-data'),

    # ── صلاحيات الصفحات (M01 فقط) ────────────────────────────────────────────
    path('api/admin/permissions/',                          dashboard_api.api_admin_permissions,        name='api-admin-permissions'),

    # ── طلبات التطوير البرمجي ──────────────────────────────────────────────
    path('api/dev-requests/',                               dashboard_api.api_dev_requests,             name='api-dev-requests'),
    path('api/dev-requests/<int:req_id>/',                  dashboard_api.api_dev_request_detail,       name='api-dev-request-detail'),

    # ── طباعة الإيصالات — صامتة عبر Python ───────────────────────────────────
    path('api/print/receipt/',                              print_api.api_print_receipt,                name='api-print-receipt'),

    # ── بوابة الوكيل الخارجي ────────────────────────────────────────────────────
    path('agent/login/',                                       views.agent_portal_login_view,                    name='agent-portal-login'),
    path('agent/portal/',                                      views.agent_portal_view,                          name='agent-portal'),
    path('api/agent/login/',                                   agent_portal_api.api_agent_portal_login,          name='api-agent-portal-login'),
    path('api/agent/logout/',                                  agent_portal_api.api_agent_portal_logout,         name='api-agent-portal-logout'),
    path('api/agent/session/',                                 agent_portal_api.api_agent_portal_session,        name='api-agent-portal-session'),
    path('api/agent/dashboard/',                               agent_portal_api.api_agent_portal_dashboard,      name='api-agent-portal-dashboard'),
    path('api/agent/transfers/',                               agent_portal_api.api_agent_portal_transfers,      name='api-agent-portal-transfers'),
    path('api/agent/transfers/<int:transfer_id>/accept/',      agent_portal_api.api_agent_portal_accept,         name='api-agent-portal-accept'),
    path('api/agent/transfers/<int:transfer_id>/reject/',      agent_portal_api.api_agent_portal_reject,         name='api-agent-portal-reject'),
    path('api/agent/transfers/<int:transfer_id>/receipt/',     agent_portal_api.api_agent_portal_upload_receipt, name='api-agent-portal-receipt'),
    path('api/agent/balance/',                                 agent_portal_api.api_agent_portal_balance,        name='api-agent-portal-balance'),
    path('api/agent/change-pin/',                              agent_portal_api.api_agent_portal_change_pin,     name='api-agent-portal-change-pin'),

    # ── واتساب بريدج ─────────────────────────────────────────────────────────
    path('api/wa/message/',              wa_api.api_wa_inbound,       name='api-wa-inbound'),
    path('api/wa/messages/',             wa_api.api_wa_messages,      name='api-wa-messages'),
    path('api/wa/groups/',               wa_api.api_wa_groups,        name='api-wa-groups'),
    path('api/wa/send/',                 wa_api.api_wa_send,          name='api-wa-send'),
    path('api/wa/pending/',              wa_api.api_wa_pending,       name='api-wa-pending'),
    path('api/wa/receipt/',              wa_api.api_wa_receipt,       name='api-wa-receipt'),
    path('api/wa/check/<str:code>/',     wa_api.api_wa_check_receipt, name='api-wa-check'),
    path('api/wa/parse/',                wa_api.api_wa_parse,         name='api-wa-parse'),
    path('api/wa/check-number/',         wa_api.api_wa_check_number,  name='api-wa-check-number'),
    path('api/wa/feed/',                 wa_api.api_wa_feed,          name='api-wa-feed'),
    path('api/wa/context/<int:msg_id>/', wa_api.api_wa_context,       name='api-wa-context'),
    path('api/wa/msg/<int:msg_id>/type/',wa_api.api_wa_update_type,   name='api-wa-update-type'),
    path('api/wa/receipts/new/',         wa_api.api_wa_receipts_new,  name='api-wa-receipts-new'),

    # ── أوامر صوتية (SSE) ────────────────────────────────────────────────────
    path('api/voice-cmd/',               voice_cmd_api.api_voice_cmd,        name='api-voice-cmd'),
    path('api/voice-cmd/stream/',        voice_cmd_api.api_voice_cmd_stream, name='api-voice-cmd-stream'),

    # ── نظام الحضور والانصراف — جهاز ZKTeco (M01 فقط) ───────────────────────
    path('attendance/',                                     views.attendance_view,                      name='attendance'),
    path('accounting/launcher/',                            views.accounting_launcher_view,             name='accounting-launcher'),
    path('accounting/safes/',                               views.am_safes_view,                        name='am-safes'),
    path('accounting/agents/',                              views.am_agents_view,                       name='am-agents'),
    path('accounting/transit/',                             views.am_transit_view,                      name='am-transit'),
    path('accounting/customers/',                           views.am_customers_view,                    name='am-customers'),
    path('accounting/cost-center/',                         views.am_cost_center_view,                  name='am-cost-center'),
    path('accounting/trash/',                               views.am_trash_view,                        name='am-trash'),
    path('accounting/safe-movement/',                       views.am_safe_movement_view,                name='am-safe-movement'),
    path('accounting/center-profits/',                      views.am_center_profits_view,               name='am-center-profits'),
    path('accounting/profit-per-safe/',                     views.am_profit_per_safe_view,              name='am-profit-per-safe'),
    path('api/center-profits/',                             am_cp_api.api_center_profits,               name='api-center-profits'),
    path('api/cost-centers/',                               am_cc_api.api_cost_centers,                  name='api-cost-centers'),
    path('api/cost-centers/<int:center_id>/',               am_cc_api.api_cost_center_detail,            name='api-cost-center-detail'),
    path('api/cost-centers/<int:center_id>/restore/',       am_cc_api.api_cost_center_restore,           name='api-cost-center-restore'),
    path('api/cost-centers/<int:center_id>/force-delete/',  am_cc_api.api_cost_center_force_delete,      name='api-cost-center-force-delete'),
    path('api/am/cost-center/',                             am_cc_api.api_cost_centers,                  name='api-am-cost-center'),
    path('api/am/center-balances/',                         am_cl_api.api_center_balances,               name='api-center-balances'),
    path('api/am/center-balances/<str:center_name>/',       am_cl_api.api_center_balance_detail,         name='api-center-balance-detail'),
    path('api/am/center-ledger/<str:center_name>/',         am_cl_api.api_center_ledger,                 name='api-center-ledger'),
    path('api/customers/',                                  am_cust_api.api_customers,                   name='api-customers'),
    path('api/customers/<int:customer_id>/',                am_cust_api.api_customer_detail,             name='api-customer-detail'),
    path('api/customers/<int:customer_id>/restore/',        am_cust_api.api_customer_restore,            name='api-customer-restore'),
    path('api/customers/<int:customer_id>/force-delete/',   am_cust_api.api_customer_force_delete,       name='api-customer-force-delete'),
    path('accounting/transfer-count/',                      views.am_transfer_count_view,               name='am-transfer-count'),
    path('accounting/entry-from-to/',                       views.am_entry_from_to_view,                name='am-entry-from-to'),
    path('api/attendance/sync/',                            attendance_api.api_attendance_sync,         name='api-attendance-sync'),
    path('api/attendance/employees/',                       attendance_api.api_attendance_employees,    name='api-attendance-employees'),
    path('api/attendance/records/',                         attendance_api.api_attendance_records,      name='api-attendance-records'),
    path('api/attendance/report/',                          attendance_api.api_attendance_report,       name='api-attendance-report'),
    path('api/attendance/device-status/',                   attendance_api.api_attendance_device_status, name='api-attendance-device-status'),
    path('api/attendance/stats/',                           attendance_api.api_attendance_stats,         name='api-attendance-stats'),
    path('api/attendance/export/excel/',                    attendance_api.api_attendance_export_excel,       name='api-attendance-export-excel'),
    path('api/attendance/export/employee/',                 attendance_api.api_attendance_employee_report,    name='api-attendance-export-employee'),
    path('api/attendance/daily/',                           attendance_api.api_attendance_daily,              name='api-attendance-daily'),
    path('api/attendance/alerts/',                          attendance_api.api_absence_alerts,                name='api-attendance-alerts'),
    path('api/attendance/employees/<int:emp_id>/notes/',    attendance_api.api_employee_notes,                name='api-employee-notes'),
    path('api/attendance/notes/<int:note_id>/',             attendance_api.api_employee_note_delete,          name='api-employee-note-delete'),
    path('api/attendance/employees/<int:emp_id>/excused/',  attendance_api.api_excused_absences,              name='api-excused-absences'),
    path('api/attendance/excused/<int:absence_id>/',        attendance_api.api_excused_absence_delete,        name='api-excused-absence-delete'),
    path('api/attendance/manual-punch/',                    attendance_api.api_attendance_manual_punch,        name='api-attendance-manual-punch'),
    path('api/attendance/records/<int:record_id>/edit/',    attendance_api.api_attendance_record_edit,         name='api-attendance-record-edit'),
    path('api/attendance/employees/<str:user_id>/rename/', attendance_api.api_attendance_rename_employee,      name='api-attendance-rename-employee'),

    # ── أسعار القص ────────────────────────────────────────────────────────────────
    path('api/cut-prices/',             am_ctp_api.api_cut_prices,        name='api-cut-prices'),
    path('api/cut-prices/<int:price_id>/', am_ctp_api.api_cut_price_detail, name='api-cut-price-detail'),

    # ── تفريق القص ────────────────────────────────────────────────────────────────
    path('api/cut-distribution/',               am_cdist_api.api_cut_distribution,        name='api-cut-distribution'),
    path('api/cut-distribution/<int:dist_id>/', am_cdist_api.api_cut_distribution_detail, name='api-cut-distribution-detail'),

    # ── إدارة العملات ─────────────────────────────────────────────────────────────
    path('api/currencies/',                      am_currencies_api.api_currencies,        name='api-currencies'),
    path('api/currencies/<int:currency_id>/',     am_currencies_api.api_currency_detail,  name='api-currency-detail'),

    # ── سجل الأحداث ───────────────────────────────────────────────────────────────
    path('api/am/audit-log/',                    am_audit_log_api.api_am_audit_log,       name='api-am-audit-log'),
]
