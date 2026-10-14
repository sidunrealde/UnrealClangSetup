export const CLANGD_TEMPLATE = `CompileFlags:
  # UE's Clang compile commands set -resource-dir to the compiler's own builtin headers (e.g. Visual Studio's
  # Clang 19). Removing it lets clangd use the headers that match its own version; a mismatch causes errors
  # such as "definition of builtin function '_m_prefetch'".
  Remove: [-m64, --target=*, -gcodeview, /guard:cf, /utf-8, -Wno-deprecated-builtins, -Wall, -resource-dir=*]
  Add:
    - -std=c++20                           
    - -fno-delayed-template-parsing       # Safely accepted by clang-cl to enforce strict standard compliance
    - -ferror-limit=0
    - -Wno-everything
    - -Wno-unknown-pragmas
    - -Wno-microsoft-enum-value
    - -Wno-microsoft-builtins
    - -Wno-msvc-not-found
    # Re-enabled after -Wno-everything (Epic coding standard): overrides must say override, no shadowed variables
    - -Wsuggest-override
    - -Wshadow

Diagnostics:
  UnusedIncludes: None
  Suppress: [
    incomplete_member_access,
    field_incomplete_or_sizeless, 
    pp_file_not_found, 
    ovl_no_viable_member_function_in_call, 
    undeclared_var_use, 
    expr_not_cce,
    member_decl_does_not_match, 
    member_call_without_object, 
    init_conversion_failed, 
    member_function_call_bad_type, 
    ovl_no_viable_function_in_call, 
    typecheck_comparison_of_distinct_pointers, 
    no_member, 
    lvalue_reference_bind_to_unrelated, 
    static_assert_requirement_failed, 
    ovl_no_viable_subscript, 
    typecheck_nonviable_condition, 
    typename_nested_not_found, 
    nested_name_spec_non_tag, 
    missing_type_specifier, 
    unknown_typename, 
    unknown_typename_suggest, 
    anon_type_definition, 
    expected_unqualified_id, 
    invalid_token_after_toplevel_declarator, 
    typecheck_decl_incomplete_type, 
    expected_semi_decl_list, 
    expected, expected_expression, 
    builtin_definition, 
    undeclared_var_use_suggest, 
    typecheck_member_reference_arrow, 
    ref_non_value, 
    no_template
  ]

  # clang-tidy settings must be nested under Diagnostics; clangd ignores them at the top level
  # Checks follow the Epic C++ Coding Standard:
  # https://dev.epicgames.com/documentation/unreal-engine/epic-cplusplus-coding-standard-for-unreal-engine
  ClangTidy:
    FastCheckFilter: None
    Add:
      - readability-identifier-naming          # PascalCase names, E prefix for enums, UPPER_CASE macros
      - readability-braces-around-statements   # braces even around single-statement blocks
      - modernize-use-nullptr                  # nullptr, never NULL
      - readability-const-return-type          # never const on by-value return types
      - readability-make-member-function-const # const methods when they don't modify the object
      - misc-const-correctness                 # const locals where possible
      - performance-unnecessary-value-param    # pass unmodified arguments by const reference
      - performance-for-range-copy             # iterate by const reference
      - readability-qualified-auto             # auto* / const auto& when auto is used
      - readability-isolate-declaration        # one variable per declaration
      - bugprone-switch-missing-default-case   # every switch has a default case
      - cppcoreguidelines-use-enum-class       # enum class instead of plain enums
      - google-runtime-int                     # int16/int64/... instead of short/long
      - google-global-names-in-headers         # no using-declarations at global scope in headers
      - google-readability-casting             # C++ casts instead of C-style casts
    Remove:
      - cppcoreguidelines-macro-usage
    CheckOptions:
      misc-const-correctness.AnalyzeValues: "true"
      misc-const-correctness.AnalyzeReferences: "true"
      misc-const-correctness.WarnPointersAsValues: "true"
      # DOREPLIFETIME declares a non-const FProperty* on every replicated property
      misc-const-correctness.AllowedTypes: "FProperty"
      readability-identifier-naming.ClassCase: CamelCase
      readability-identifier-naming.StructCase: CamelCase
      readability-identifier-naming.UnionCase: CamelCase
      readability-identifier-naming.EnumCase: CamelCase
      readability-identifier-naming.EnumPrefix: E
      readability-identifier-naming.TypeAliasCase: CamelCase
      readability-identifier-naming.TypedefCase: CamelCase
      readability-identifier-naming.TemplateParameterCase: CamelCase
      readability-identifier-naming.NamespaceCase: CamelCase
      readability-identifier-naming.FunctionCase: CamelCase
      readability-identifier-naming.MethodCase: CamelCase
      # UE naming patterns with underscores: K2_ functions, OnRep_ notifies, RPC _Implementation/_Validate,
      # and the exec thunks GENERATED_BODY() declares for each UFUNCTION
      readability-identifier-naming.MethodIgnoredRegexp: "^(K2_|OnRep_).+|.+_(Implementation|Validate)$|^exec[A-Z].*"
      readability-identifier-naming.VariableCase: CamelCase
      readability-identifier-naming.ParameterCase: CamelCase
      readability-identifier-naming.MemberCase: CamelCase
      # Booleans use a b prefix (bHasFadedIn, bOutSucceeded). Locals declared by engine macros
      # (UE_LOG's LOG_Dynamic, scoped stat/trace counters) are ignored too.
      readability-identifier-naming.VariableIgnoredRegexp: "^b[A-Z].*|^[A-Z][A-Z0-9]*_.*|^_.*"
      readability-identifier-naming.ParameterIgnoredRegexp: "^b[A-Z].*"
      readability-identifier-naming.MemberIgnoredRegexp: "^b[A-Z].*"
      readability-identifier-naming.MacroDefinitionCase: UPPER_CASE
      google-runtime-int.SignedTypePrefix: int
      google-runtime-int.UnsignedTypePrefix: uint
      google-runtime-int.TypeSuffix: ""
`;
