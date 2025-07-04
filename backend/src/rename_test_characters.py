
from characters.models import Character

def rename_test_characters():
    try:
        stand_user = Character.objects.get(alias='Standy')
        stand_user.true_name = 'Standy - Level 1 Character Test'
        stand_user.save()
        print("Renamed Standy to 'Standy - Level 1 Character Test'.")
    except Character.DoesNotExist:
        print("Standy not found.")

    try:
        spin_user = Character.objects.get(alias='Spiny')
        spin_user.true_name = 'Spiny - Level 1 Character Test'
        spin_user.save()
        print("Renamed Spiny to 'Spiny - Level 1 Character Test'.")
    except Character.DoesNotExist:
        print("Spiny not found.")

    try:
        hamon_user = Character.objects.get(alias='Hammy')
        hamon_user.true_name = 'Hammy - Level 1 Character Test'
        hamon_user.save()
        print("Renamed Hammy to 'Hammy - Level 1 Character Test'.")
    except Character.DoesNotExist:
        print("Hammy not found.")

rename_test_characters()
