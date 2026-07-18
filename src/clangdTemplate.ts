export const CLANGD_TEMPLATE = `CompileFlags:
  Remove: [-m64, --target=*, -gcodeview, /guard:cf, /utf-8, -Wno-deprecated-builtins, -Wall]
  Add:
    - -std=c++20                           
    - -fno-delayed-template-parsing       # Safely accepted by clang-cl to enforce strict standard compliance
    - -ferror-limit=0
    - -Wno-everything
    - -Wno-unknown-pragmas
    - -Wno-microsoft-enum-value
    - -Wno-microsoft-builtins
    - -Wno-msvc-not-found

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


ClangTidy:
  FastCheckFilter: None                    
  Add:
    - misc-const-correctness
    - readability-const-return-type
    - readability-braces-around-statements
    - modernize-use-nullptr
    - modernize-use-override
    - google-readability-casting
    - readability-identifier-naming
  Remove:
    - cppcoreguidelines-macro-usage        
    - bugprone-hdr-checker                 

CheckOptions:
  misc-const-correctness.AnalyzeValues: "true"
  misc-const-correctness.AnalyzeReferences: "true"
  misc-const-correctness.WarnPointersAsValues: "true"
  readability-identifier-naming.BooleanPrefix: "b"
  readability-identifier-naming.VariableCase: "aNy_CaSe"
  readability-identifier-naming.ParameterCase: "aNy_CaSe"
  readability-identifier-naming.MemberCase: "aNy_CaSe"
`;
