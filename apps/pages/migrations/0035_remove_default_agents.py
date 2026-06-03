from django.db import migrations


def remove_default_agents(apps, schema_editor):
    ExecutionAgent = apps.get_model('pages', 'ExecutionAgent')
    ExecutionAgent.objects.filter(
        name__in=['برهوم تونس', 'وكيل 2', 'وكيل 3']
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('pages', '0034_agent_locations_rates'),
    ]

    operations = [
        migrations.RunPython(remove_default_agents, migrations.RunPython.noop),
    ]
