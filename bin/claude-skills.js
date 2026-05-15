#!/usr/bin/env node
'use strict';

const { parseArgs } = require('node:util');
const kleur = require('kleur');

const { install } = require('../lib/install');
const { remove, removeAll } = require('../lib/remove');
const { listLibrary, listInstalled } = require('../lib/list');
const { listLibrarySkills, listInstalledSkills } = require('../lib/skills');
const { getInstallDir } = require('../lib/paths');

const VERSION = require('../package.json').version;

function printHelp() {
  console.log(`
${kleur.bold('claude-skills')} ${kleur.dim('v' + VERSION)}
A curated library of Claude Code skills.

${kleur.bold('USAGE')}
  npx claude-skills <command> [options]

${kleur.bold('COMMANDS')}
  list                       List skills available in the library
  installed                  List skills installed locally
  install                    Interactive picker — choose what to install
  install <name>...          Install one or more skills by name
  install --all              Install every skill in the library
  remove <name>...           Remove installed skill(s)
  remove --all               Remove all installed skills
  help                       Show this help

${kleur.bold('OPTIONS')}
  -g, --global               Install/remove at ~/.claude/skills   ${kleur.dim('(default)')}
  -p, --project              Install/remove at ./.claude/skills
  -f, --force                Overwrite if already installed
  -h, --help                 Show help
  -v, --version              Show version

${kleur.bold('EXAMPLES')}
  npx claude-skills list
  npx claude-skills install              ${kleur.dim('# interactive picker')}
  npx claude-skills install pdf docx     ${kleur.dim('# specific skills')}
  npx claude-skills install --all -p     ${kleur.dim('# all skills, in project')}
  npx claude-skills remove pdf
`);
}

const OPTIONS = {
  global: { type: 'boolean', short: 'g' },
  project: { type: 'boolean', short: 'p' },
  force: { type: 'boolean', short: 'f' },
  all: { type: 'boolean', short: 'a' },
  help: { type: 'boolean', short: 'h' },
  version: { type: 'boolean', short: 'v' },
};

function resolveScope(values) {
  if (values.project && values.global) {
    console.error(kleur.red('Cannot use --global and --project together.'));
    process.exit(1);
  }
  if (values.project) return 'project';
  return 'global';
}

async function interactiveInstall(scope, force) {
  // Lazy-require so plain `list` doesn't pay the import cost.
  const { checkbox } = require('@inquirer/prompts');

  const installDir = getInstallDir(scope);
  const library = listLibrarySkills();
  const installed = new Set(listInstalledSkills(installDir).map((s) => s.slug));

  if (library.length === 0) {
    console.log(kleur.yellow('No skills available in the library.'));
    return;
  }

  const choices = library.map((s) => ({
    name: `${s.name}  ${kleur.dim('— ' + s.description.replace(/\s+/g, ' ').slice(0, 70))}`,
    value: s.slug,
    checked: installed.has(s.slug),
  }));

  let selected;
  try {
    selected = await checkbox({
      message: `Select skills to install (${scope})`,
      choices,
      pageSize: 15,
    });
  } catch (err) {
    if (err && err.name === 'ExitPromptError') {
      console.log(kleur.dim('Cancelled.'));
      return;
    }
    throw err;
  }

  if (selected.length === 0) {
    console.log(kleur.dim('Nothing selected.'));
    return;
  }

  install(selected, { scope, force: true /* user explicitly picked these */ });
}

async function main() {
  // Split out the subcommand from option parsing so we can hand the rest to parseArgs.
  const argv = process.argv.slice(2);
  if (argv.length === 0) {
    printHelp();
    return;
  }

  const command = argv[0];
  const rest = argv.slice(1);

  let parsed;
  try {
    parsed = parseArgs({
      args: rest,
      options: OPTIONS,
      allowPositionals: true,
      strict: true,
    });
  } catch (err) {
    console.error(kleur.red(err.message));
    process.exit(1);
  }

  const { values, positionals } = parsed;

  if (values.help || command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    return;
  }
  if (values.version || command === '--version' || command === '-v') {
    console.log(VERSION);
    return;
  }

  const scope = resolveScope(values);

  switch (command) {
    case 'list':
    case 'ls':
      listLibrary({ scope });
      break;

    case 'installed':
      listInstalled({ scope });
      break;

    case 'install':
    case 'add': {
      if (values.all) {
        install([], { scope, force: values.force, all: true });
      } else if (positionals.length === 0) {
        await interactiveInstall(scope, values.force);
      } else {
        install(positionals, { scope, force: values.force });
      }
      break;
    }

    case 'remove':
    case 'rm':
    case 'uninstall': {
      if (values.all) {
        removeAll({ scope });
      } else {
        remove(positionals, { scope });
      }
      break;
    }

    default:
      console.error(kleur.red(`Unknown command: ${command}`));
      console.error(kleur.dim(`Run "npx claude-skills help" to see available commands.`));
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(kleur.red('Error:'), err.message);
  process.exit(1);
});
