from django.core.management.base import BaseCommand
from characters.models import Campaign, Crew

class Command(BaseCommand):
    help = 'Renames the crew for a specific campaign.'

    def handle(self, *args, **options):
        campaign_name = "A History of Bad Men"
        old_crew_name = "1-800-Bizarre"
        new_crew_name = "The Bad Men"

        try:
            campaign = Campaign.objects.get(name=campaign_name)
            crew = Crew.objects.get(campaign=campaign, name=old_crew_name)

            crew.name = new_crew_name
            crew.save()
            self.stdout.write(self.style.SUCCESS(f'Successfully renamed crew "{old_crew_name}" to "{new_crew_name}" for campaign "{campaign_name}".'))

        except Campaign.DoesNotExist:
            self.stdout.write(self.style.ERROR(f'Campaign "{campaign_name}" not found.'))
        except Crew.DoesNotExist:
            self.stdout.write(self.style.ERROR(f'Crew "{old_crew_name}" not found for campaign "{campaign_name}".'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'An error occurred: {e}'))
