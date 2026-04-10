from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.db import IntegrityError


class Command(BaseCommand):
    help = "Create test user accounts"

    def handle(self, *args, **options):
        # List of usernames to create
        usernames = [
            "test_player_1",
            "test_player_2",
            "test_player_3",
            "test_player_4",
            "test_player_5",
            "test_player_6",
            "test_player_7",
        ]

        password = User.objects.make_random_password()
        created_count = 0
        skipped_count = 0

        self.stdout.write(self.style.SUCCESS("Creating test user accounts..."))

        for username in usernames:
            try:
                # Check if user already exists
                if User.objects.filter(username=username).exists():
                    self.stdout.write(
                        self.style.WARNING(
                            f'User "{username}" already exists - skipping'
                        )
                    )
                    skipped_count += 1
                    continue

                # Create new user
                user = User.objects.create_user(
                    username=username,
                    password=password,
                    email=f"{username}@example.com",  # Set a default email
                )

                self.stdout.write(self.style.SUCCESS(f'✓ Created user "{username}"'))
                created_count += 1

            except IntegrityError as e:
                self.stdout.write(
                    self.style.ERROR(f'Error creating user "{username}": {e}')
                )
            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(
                        f'Unexpected error creating user "{username}": {e}'
                    )
                )

        # Summary
        self.stdout.write("\n" + "=" * 50)
        self.stdout.write(self.style.SUCCESS(f"Summary:"))
        self.stdout.write(f"  • Created: {created_count} users")
        self.stdout.write(f"  • Skipped: {skipped_count} users (already exist)")
        self.stdout.write(f"  • Total processed: {len(usernames)} users")

        if created_count > 0:
            self.stdout.write(
                self.style.SUCCESS(
                    f"\nCreated {created_count} users with randomised passwords."
                )
            )

        self.stdout.write("=" * 50)
