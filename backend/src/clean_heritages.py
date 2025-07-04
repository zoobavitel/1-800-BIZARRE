from characters.models import Heritage

# First, let's see what we have before deletion
print("Before deletion:")
heritages = Heritage.objects.all().order_by('id')
for heritage in heritages:
    print(f"  {heritage.id}: {heritage.name}")

print("\nDeleting duplicate Oracle (ID: 10) and Chimera (ID: 9)...")

# Delete the duplicate Oracle entry (ID: 10)
try:
    duplicate_oracle = Heritage.objects.get(id=10)
    duplicate_oracle.delete()
    print("Deleted duplicate Oracle entry (ID: 10)")
except Heritage.DoesNotExist:
    print("Duplicate Oracle entry (ID: 10) not found")

# Delete the Chimera entry (ID: 9)
try:
    chimera = Heritage.objects.get(id=9)
    chimera.delete()
    print("Deleted Chimera entry (ID: 9)")
except Heritage.DoesNotExist:
    print("Chimera entry (ID: 9) not found")

print("\nAfter deletion:")
heritages = Heritage.objects.all().order_by('id')
for heritage in heritages:
    print(f"  {heritage.id}: {heritage.name}") 