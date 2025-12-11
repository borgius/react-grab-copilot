# Prompt Improvement API Example

This example demonstrates how to use the `/prompt` endpoint to get improved prompt variants.

## Basic Usage

### Request

```bash
curl -X POST http://localhost:6567/prompt \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "fix this bug",
    "content": "function calculateTotal(items) {\n  return items.map(i => i.price).reduce((a, b) => a + b);\n}",
    "systemPrompt": "You are a TypeScript expert focused on writing robust, type-safe code.",
    "options": {
      "model": "gpt-4o"
    }
  }'
```

### Response

```json
{
  "variants": [
    "Fix the bug in the calculateTotal function that causes an error when the items array is empty - add a check or provide an initial value to reduce",
    "Debug and fix the reduce operation in calculateTotal to handle empty arrays and ensure it returns 0 when no items are present",
    "Correct the TypeError in calculateTotal by providing an initial value (0) to the reduce function to handle edge cases with empty item arrays"
  ]
}
```

## With Project Context

When you provide more context about your project, the improved prompts will be more specific:

### Request

```bash
curl -X POST http://localhost:6567/prompt \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "add validation",
    "content": "// src/components/UserForm.tsx\nexport function UserForm() {\n  const [email, setEmail] = useState(\"\");\n  const [age, setAge] = useState(\"\");\n  \n  const handleSubmit = () => {\n    // TODO: add validation\n  };\n}",
    "options": {
      "model": "gpt-4o"
    }
  }'
```

### Response

```json
{
  "variants": [
    "Add comprehensive validation to the UserForm component: validate email format using regex, ensure age is a positive number, display error messages below each field, and disable submit button until all fields are valid",
    "Implement form validation in UserForm.tsx: check email is valid and not empty, verify age is numeric and within reasonable range (e.g., 0-120), show inline error messages using React state, prevent submission of invalid data",
    "Add client-side validation to the UserForm handleSubmit function: validate email format against RFC 5322 standard, ensure age is a valid integer, provide user feedback for validation errors, and only proceed with submission when all inputs are valid"
  ]
}
```

## Integration in VS Code Extension

In your extension, you can call this endpoint before sending the final prompt to `/agent`:

```typescript
async function improvePrompt(originalPrompt: string, context: string): Promise<string[]> {
  const response = await fetch('http://localhost:6567/prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: originalPrompt,
      content: context,
      options: { model: 'gpt-4o' }
    })
  });
  
  const data = await response.json();
  return data.variants;
}

// Usage
const variants = await improvePrompt('fix this bug', sourceCode);
// Show variants to user in QuickPick
const selected = await vscode.window.showQuickPick(variants, {
  placeHolder: 'Select an improved prompt variant'
});

if (selected) {
  // Use selected variant with /agent endpoint
  // ...
}
```

## Tips for Best Results

1. **Provide Context**: Include relevant code snippets, file paths, or project information in the `content` field
2. **Be Specific**: Even vague prompts will be improved, but starting with some specificity helps
3. **Use Project Knowledge**: If you have an AGENTS.md file in your project, the improved prompts will consider project conventions
4. **Review Variants**: The 3 variants offer different perspectives - choose the one that best matches your intent
