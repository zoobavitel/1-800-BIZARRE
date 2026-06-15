from django.core.management.base import BaseCommand

from characters.services.sheet_export.template_builder import build_all_templates


class Command(BaseCommand):
    help = "Regenerate fillable PC and NPC character sheet PDF templates."

    def handle(self, *args, **options):
        build_all_templates()
        self.stdout.write(self.style.SUCCESS("Sheet PDF templates rebuilt."))
