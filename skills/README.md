# Agent Skills

[Claude Code skills](https://docs.claude.com/en/docs/claude-code/skills) for working with LLM Gateway. Each skill is a single `SKILL.md` file with YAML frontmatter that Claude Code loads automatically when its description matches what you ask.

## Available skills

| Skill                    | Trigger     | What it does                                                                                                      |
| ------------------------ | ----------- | ----------------------------------------------------------------------------------------------------------------- |
| [changelog](./changelog) | `changelog` | Writes a new LLM Gateway changelog entry in the house style, plus a `gpt-image-2` prompt for its OpenGraph image. |

## Installing a skill

Copy the skill folder into your project's `.claude/skills/` directory:

```bash
cp -r skills/changelog /path/to/your/project/.claude/skills/
```

Or place it in `~/.claude/skills/` to make it available across every project. Then trigger it by name inside Claude Code:

```
> changelog
```

## Contributing a skill

1. Create a folder under `skills/` named after the skill (kebab-case).
2. Add a `SKILL.md` with `name` and `description` frontmatter. Write the `description` so its trigger phrases match the requests the skill should handle.
3. Keep instructions concrete and self-contained; reference any supporting files relatively.
4. Add a row to the table above and the **Skills** section of the root [`README.md`](../README.md).
