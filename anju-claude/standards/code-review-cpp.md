# C++ and Unreal Engine Coding Standards

## Core Review Checklist

### General Code Quality
- ✅ Code is clear and readable
- ✅ Functions and variables are well-named
- ✅ No duplicated code (DRY principle)
- ✅ Proper error handling and edge cases covered
- ✅ Good separation of concerns
- ✅ Comments explain "why", not "what"

### Security (Critical)
- 🔒 No exposed secrets, API keys, or credentials
- 🔒 Input validation implemented properly
- 🔒 No SQL injection, buffer overflow, or XSS vulnerabilities
- 🔒 Sensitive data properly encrypted/protected
- 🔒 Authentication and authorization checks in place

### C++ Specific

#### Memory Management
- Smart pointers (std::unique_ptr, std::shared_ptr) over raw pointers for ownership
- RAII: constructors acquire resources, destructors release
- Clear ownership semantics (who owns what, who deletes what)
- No memory leaks, dangling pointers, or double deletes
- Proper use of move semantics (std::move)

#### C++ Best Practices
- const correctness (const methods, const& parameters for large objects)
- Use nullptr, never NULL or 0
- auto for type deduction where it improves clarity
- Range-based for loops when appropriate
- constexpr for compile-time constants
- Proper header guards (#pragma once)
- Forward declarations to reduce compilation dependencies
- Correct include order (own header, project, engine, std)

#### Performance
- Pass large objects by const reference to avoid copies
- Reserve container capacity when size is known
- Eliminate unnecessary object copies
- Be aware of virtual function call overhead in hot paths
- Consider inline for small, frequently called functions

### Unreal Engine Specific

#### UObject System & Reflection
- UPROPERTY() with correct specifiers (EditAnywhere, BlueprintReadWrite, Replicated, etc.)
- UFUNCTION() with appropriate specifiers (BlueprintCallable, Server, Client, etc.)
- UCLASS/USTRUCT/UENUM properly used
- GENERATED_BODY() included in all reflected types
- UObject* marked with UPROPERTY() to prevent GC issues

#### Unreal Memory Management
- TObjectPtr<T> for UObject pointers (UE5+)
- TWeakObjectPtr for weak references
- TSoftObjectPtr for soft references
- NewObject vs CreateDefaultSubobject used correctly
- Never manually delete UObjects (use GC system)
- Objects referenced from non-UObject classes properly rooted

#### Unreal Containers & Algorithms
- TArray preferred over std::vector (UPROPERTY support)
- TMap/TSet used properly
- Algo namespace utilities (Algo::Sort, Algo::Transform, etc.)
- MoveTemp() instead of std::move in Unreal code
- Reserve/Empty/Reset for container performance

#### Unreal Smart Pointers (Non-UObject)
- TSharedPtr/TSharedRef for non-UObject shared ownership
- TWeakPtr for non-UObject weak references
- TUniquePtr for non-UObject unique ownership
- Never use on UObjects (they have their own GC)

#### Threading & Concurrency
- Game thread safety: know what must run on game thread
- FCriticalSection/FScopeLock for proper mutex usage
- FRWLock for read-write scenarios
- Async() for background tasks
- Atomic operations (FPlatformAtomics or std::atomic)
- Never access UObjects from non-game threads without synchronization

#### Performance Considerations
- Minimize Tick() work, disable when not needed
- TRACE_CPUPROFILER_EVENT_SCOPE for performance-critical sections
- Avoid Blueprint-exposed functions in hot paths
- Avoid heavy work in constructors
- Cache GetWorld() pointer instead of repeated calls
- Use FindObject/LoadObject sparingly (expensive)

#### Unreal Coding Standards
- Naming: U (UObject), A (AActor), F (struct), E (enum), I (interface)
- Member prefixes: b (bool), I/Num (int32)
- Include what you use, .generated.h always last in headers
- check(), ensure(), checkSlow() used appropriately
- UE_LOG with proper categories and verbosity

#### Blueprint Integration
- BlueprintCallable only for necessary functions
- BlueprintPure for functions without side effects
- Meta specifiers (DisplayName, Category) used properly
- Blueprint call overhead considered

#### Networking (if applicable)
- UPROPERTY(Replicated) used correctly
- RepNotify (ReplicatedUsing) implemented properly
- GetLifetimeReplicatedProps() implemented for replicated actors
- Server/Client RPCs properly validated
- Network relevancy and optimization considered

### Testing & Performance
- Good test coverage for critical paths
- Code is testable (dependencies can be mocked)
- Performance considerations addressed
- No obvious performance bottlenecks
