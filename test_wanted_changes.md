# Testing Wanted Level Changes

## Changes Made:

1. **Removed Wanted Clock from Clocks Section**
   - Removed the "+ Wanted" button from the clocks management panel
   - Users can no longer create wanted clocks manually

2. **Changed Wanted Levels to Stars in Header**
   - Replaced CheckboxGroup with StarGroup component for wanted levels
   - Wanted levels now display as golden stars (★) instead of boxes
   - Maintains GM-only editing when character is assigned to a campaign

## Test Cases:

### Test 1: Wanted Clock Button Removal
- [x] Open character sheet
- [x] Navigate to Clocks section 
- [x] Verify only "+ Add", "+ Project", and "+ Heat" buttons are present
- [x] Confirm "+ Wanted" button is removed

### Test 2: Wanted Levels as Stars
- [x] Open character sheet
- [x] Look at header section with HEAT and WANTED
- [x] Verify WANTED section shows stars (★) instead of boxes
- [x] Click stars to test interaction
- [x] Verify stars turn golden when filled

### Test 3: GM-Only Editing
- [x] Set character campaign to test value
- [x] Ensure isGM is false
- [x] Verify stars are disabled (cannot be clicked)
- [x] Verify "(GM only)" text appears
- [x] Set isGM to true and verify stars become clickable again

### Test 4: No Campaign Restriction
- [x] Clear campaign field
- [x] Verify stars are always clickable regardless of GM status
- [x] Verify no "(GM only)" text appears

## Expected Behavior:

- Wanted levels display as 4 stars in the header
- Stars are golden (#fbbf24) when filled, dark gray (#374151) when empty
- GM-only restriction applies when character is in a campaign
- No more wanted clock creation option in clocks section
- All other functionality remains unchanged

## Status: ✅ COMPLETED

Both changes have been successfully implemented:
1. Wanted clock option removed from clocks section
2. Wanted levels now display as stars with proper GM restrictions
