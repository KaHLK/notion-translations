# notion-translations

A tool that allows you to use notion databases as the backend for i18n dictionaries.

## Supported formats
* I18next
* Android string xml resource

## Installation

The tool is not currently published so to use it you must use a direct url to this repository:
```
git+https://github.com/kahlk/notion-translations
git+ssh://git@github.com:kahlk/notion-translations
```

It can either be installed globally with `npm i -g`, run with `npx`, or installed in a npm project using the package manager of your choice.


# How to use

Get a notion api key by navigating to [my integrations](https://www.notion.so/my-integrations) and create a new integration.

Then navigate to `capabilities` and adjust the permissions given to the extension. The following permissions are required to use specific commands of this tool (if a command is not listed, it does not talk with the notion api):

action | Read | Write | Insert
| - | - | - | - |
| local add | [x] | [ ] | [ ] |
| local sync | [x] | [ ] | [ ] |
| remote new | [x] | [ ] | [x] |
| remote normalize | [x] | [x] | [x] |
| remote import | [x] | [ ] | [x] |
| gen | [x] | [ ] | [ ] |

Copy the integration API key and pass it into the tool as a environment variable (supports dotenv, so you can save the api key in a .env file).

## Setup

Run the `translation init` to create a new `notion-translate.json` (change the output directory with `--out <directory>`).

Add the desired databases with `translation local add`.

### Import (optional)

You can import existing translation files into your notion databases using `translation remote import [options]`

## Generate translation files

After you have added the desired databases to the local config, and created the desired translations in notion, you can fetch the databases and generate files of the desired format, run `translation gen [options]`
