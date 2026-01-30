# Unreal Engine Coding Standards

## Brace Style for Control Statements

### Rule
All control statements (`if`, `else`, `for`, `while`, `do`, `switch`) **MUST** use braces `{}`, even for single-line bodies.

### Example
```cpp
// ❌ Prohibited
if (condition) DoSomething();
if (condition)
    DoSomething();

// ✅ Required
if (condition)
{
    DoSomething();
}
```

---

## Loop Variable Naming Convention

### Rule
Use **meaningful names** instead of single-character variables (`i`, `j`, `k`) for loop indices.
Short names like `Index` are acceptable for simple loops.

### Why
- Improves code readability
- Prevents variable confusion in nested loops
- Clearly conveys the variable's role and purpose

### Naming Guidelines
| Context | Recommended Name |
|---------|------------------|
| Simple loop (single level, short body) | `Index` |
| Nested loops (2+ levels) | Specific names (`ItemIndex`, `SubItemIndex`) |
| Complex loop body | Specific names |
| Batch processing | `BatchIndex`, `BatchStartIndex` |
| Row/Column | `RowIndex`, `ColumnIndex` |

### Example
```cpp
// ❌ Prohibited
for (int32 i = 0; i < Names.Num(); ++i)

// ✅ Simple loop - short meaningful name
for (int32 Index = 0; Index < Names.Num(); ++Index)
{
    UE_LOG(LogTemp, Log, TEXT("%s"), *Names[Index]);
}

// ✅ Nested loops - specific names
for (int32 ItemIndex = 0; ItemIndex < Items.Num(); ++ItemIndex)
{
    for (int32 SubItemIndex = 0; SubItemIndex < Items[ItemIndex].SubItems.Num(); ++SubItemIndex)
    {
        Process(Items[ItemIndex].SubItems[SubItemIndex]);
    }
}
```

### Code Review Checklist
- [ ] No single-character loop indices (`i`, `j`, `k`)?
- [ ] Each variable clearly distinguished in nested loops?

---

## PascalCase Naming Convention

### Rule
All identifiers in Unreal Engine C++ **MUST** use `PascalCase`, following Epic's naming standards.

### Why
- Consistency with Epic's codebase and UE API
- Immediate recognition of identifier types via prefixes
- Reduces naming conflicts and improves IntelliSense/autocomplete

### Naming Standards by Type

#### Variables
```cpp
// ✅ PascalCase for all variables
int32 PlayerHealth;
float MaxSpeed;
FString CharacterName;

// ✅ Booleans: Prefix with 'b'
bool bIsActive;
bool bShouldUpdate;
bool bHasWeapon;

// ❌ Prohibited
int32 player_health;      // snake_case
float maxSpeed;           // camelCase
bool IsActive;            // Missing 'b' prefix
```

#### Functions and Methods
```cpp
// ✅ PascalCase with verb prefix
int32 GetPlayerHealth() const;
void SetMaxSpeed(float NewSpeed);
void UpdateCharacterState();

// ❌ Prohibited
void update_character_state();  // snake_case
void getHealth();               // camelCase
```

#### Classes and Structs
```cpp
// ✅ UObject-derived: 'U' prefix
UCLASS()
class UMyComponent : public UActorComponent { };

// ✅ AActor-derived: 'A' prefix
UCLASS()
class AMyCharacter : public ACharacter { };

// ✅ Plain structs: 'F' prefix
USTRUCT()
struct FPlayerData { };

// ✅ Interfaces: 'I' prefix
UINTERFACE()
class UMyInterface : public UInterface { };

class IMyInterface
{
    GENERATED_BODY()
};

// ✅ Templates: 'T' prefix
template<typename T>
class TMyContainer { };
```

#### Enums
```cpp
// ✅ Enum type: 'E' prefix, values in PascalCase
UENUM()
enum class EWeaponType
{
    None,
    Sword,
    Bow,
    Magic
};

// Usage
EWeaponType CurrentWeapon = EWeaponType::Sword;
```

#### Constants
```cpp
// ✅ Option 1: PascalCase (Epic uses both)
const float MaxWalkSpeed = 600.0f;

// ✅ Option 2: UPPER_CASE (also acceptable)
const float MAX_WALK_SPEED = 600.0f;

// Prefer PascalCase for consistency with other identifiers
```

#### Member Variables
```cpp
class AMyActor : public AActor
{
    // ✅ Public/Protected: PascalCase
    UPROPERTY()
    int32 CurrentHealth;

    // ✅ Private: No special prefix needed in modern UE
    private:
    float InternalTimer;

    // ❌ Deprecated: Don't use 'm_' prefix
    float m_timer;  // Old C++ convention, not UE style
};
```

### UE Prefix Quick Reference

| Prefix | Type | Example |
|--------|------|---------|
| `U` | UObject-derived class | `UMyComponent` |
| `A` | AActor-derived class | `AMyCharacter` |
| `F` | Plain struct/class | `FPlayerData`, `FVector` |
| `T` | Template class | `TArray`, `TMap` |
| `E` | Enum | `EWeaponType` |
| `I` | Interface class | `IMyInterface` |
| `b` | Boolean variable | `bIsActive` |

### Example: Complete Class
```cpp
UCLASS()
class AMyCharacter : public ACharacter
{
    GENERATED_BODY()

public:
    // ✅ UPROPERTY with PascalCase
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    int32 MaxHealth;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly)
    bool bIsInCombat;

    // ✅ Functions with PascalCase
    UFUNCTION(BlueprintCallable)
    void TakeDamage(int32 DamageAmount);

    UFUNCTION(BlueprintPure)
    int32 GetCurrentHealth() const;

private:
    // ✅ Private members: PascalCase
    int32 CurrentHealth;
    float RegenerationRate;

    void UpdateHealthRegeneration();
};
```

### Code Review Checklist
- [ ] All classes use correct prefix (U/A/F/T/E/I)?
- [ ] All booleans prefixed with 'b'?
- [ ] All identifiers in PascalCase (no snake_case/camelCase)?
- [ ] No deprecated prefixes (m_, g_, s_)?
- [ ] Enum values in PascalCase?