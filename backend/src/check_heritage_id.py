from characters.models import Heritage

try:
    human_heritage = Heritage.objects.get(name="human")
    print(f"Heritage 'human' ID: {human_heritage.id}")
except Heritage.DoesNotExist:
    print("Heritage 'human' not found.")
    
# Also list all available heritages for reference
print("\nAll available heritages:")
heritages = Heritage.objects.all()
for heritage in heritages:
    print(f"  {heritage.id}: {heritage.name}") 