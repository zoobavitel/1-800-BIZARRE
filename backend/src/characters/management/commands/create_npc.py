from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from characters.models import NPC, Campaign

class Command(BaseCommand):
    help = 'Creates a new NPC for a given campaign.'

    def add_arguments(self, parser):
        parser.add_argument('name', type=str, help='The name of the NPC.')
        parser.add_argument('campaign_id', type=int, help='The ID of the campaign the NPC belongs to.')
        parser.add_argument('creator_id', type=int, help='The ID of the user creating the NPC.')
        parser.add_argument('--power', type=str, default='D', help='Stand Power rating (S, A, B, C, D, F).')
        parser.add_argument('--speed', type=str, default='D', help='Stand Speed rating (S, A, B, C, D, F).')
        parser.add_argument('--range', type=str, default='D', help='Stand Range rating (S, A, B, C, D, F).')
        parser.add_argument('--durability', type=str, default='D', help='Stand Durability rating (S, A, B, C, D, F).')
        parser.add_argument('--precision', type=str, default='F', help='Stand Precision rating (S, A, B, C, D, F).')
        parser.add_argument('--development', type=str, default='F', help='Stand Development Potential rating (S, A, B, C, D, F).')
        parser.add_argument('--harm_clock_max', type=int, default=4, help='The maximum segments for the NPC's Harm Clock.')


    def handle(self, *args, **options):
        name = options['name']
        campaign_id = options['campaign_id']
        creator_id = options['creator_id']
        
        power = options['power'].upper()
        speed = options['speed'].upper()
        range_stat = options['range'].upper()
        durability = options['durability'].upper()
        precision = options['precision'].upper()
        development = options['development'].upper()
        harm_clock_max = options['harm_clock_max']

        try:
            campaign = Campaign.objects.get(pk=campaign_id)
        except Campaign.DoesNotExist:
            self.stdout.write(self.style.ERROR(f'Campaign with ID "{campaign_id}" does not exist.'))
            return

        try:
            creator = User.objects.get(pk=creator_id)
        except User.DoesNotExist:
            self.stdout.write(self.style.ERROR(f'User with ID "{creator_id}" does not exist.'))
            return

        grade_points = {'S': 5, 'A': 4, 'B': 3, 'C': 2, 'D': 1, 'F': 0}

        stand_coin_stats = {
            'POWER': power,
            'SPEED': speed,
            'RANGE': range_stat,
            'DURABILITY': durability,
            'PRECISION': precision,
            'DEVELOPMENT': development,
        }
        
        total_points = sum(grade_points.get(grade, 0) for grade in stand_coin_stats.values())
        
        level = 1 + (total_points - 10) if total_points > 10 else 1

        npc = NPC.objects.create(
            name=name,
            campaign=campaign,
            creator=creator,
            level=level,
            stand_coin_stats=stand_coin_stats,
            harm_clock_max=harm_clock_max,
        )

        self.stdout.write(self.style.SUCCESS(f'Successfully created NPC "{npc.name}" with ID {npc.id} at level {npc.level}.'))
