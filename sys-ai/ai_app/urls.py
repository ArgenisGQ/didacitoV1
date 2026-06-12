from django.urls import path
from . import views

urlpatterns = [
    path('ingest/<int:subject_id>/', views.ingest_syllabus, name='ingest_syllabus'),
    path('evaluate/<int:plan_id>/', views.evaluate_plan, name='evaluate_plan'),
    path('evaluation/<int:plan_id>/', views.get_evaluation, name='get_evaluation'),
    path('admin/rag-status/', views.rag_status, name='rag_status'),
    path('admin/sync-all/', views.sync_all_syllabuses, name='sync_all_syllabuses'),
    path('admin/sync-all-plans/', views.sync_all_plans, name='sync_all_plans'),
    path('admin/cancel-sync/', views.cancel_sync, name='cancel_sync'),
    path('admin/sync-plan/<int:plan_id>/', views.sync_single_plan, name='sync_single_plan'),
    path('admin/providers', views.admin_providers, name='admin_providers'),
    path('admin/providers/<int:provider_id>', views.admin_providers_detail, name='admin_providers_detail'),
    path('admin/templates', views.admin_templates, name='admin_templates'),
    path('admin/templates/<int:template_id>', views.admin_templates_detail, name='admin_templates_detail'),
    path('admin/assignments', views.admin_assignments, name='admin_assignments'),
    path('admin/assignments/<int:assignment_id>', views.admin_assignments_detail, name='admin_assignments_detail'),
    path('admin/rag-logs/', views.rag_logs, name='rag_logs'),
    path('admin/test-provider/', views.test_provider_connection, name='test_provider_connection'),
    path('admin/chat-rag/', views.chat_rag, name='chat_rag'),
    path('chat/sessions/', views.list_chat_sessions, name='list_chat_sessions'),
    path('chat/sessions/<int:session_id>/messages/', views.get_chat_messages, name='get_chat_messages'),
    path('chat/sessions/<int:session_id>/', views.delete_chat_session, name='delete_chat_session'),
    path('chat/sessions/clear-all/', views.clear_all_chats, name='clear_all_chats'),
    path('admin/metrics/summary/', views.ai_metrics_summary, name='ai_metrics_summary'),
    path('admin/metrics/evaluations/export/', views.ai_metrics_evaluations_export, name='ai_metrics_evaluations_export'),
    path('admin/metrics/chats/export/', views.ai_metrics_chats_export, name='ai_metrics_chats_export'),
    path('admin/metrics/tokens/export/', views.ai_metrics_tokens_export, name='ai_metrics_tokens_export'),
]

