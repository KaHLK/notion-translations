# notion-translations

A tool that allows you to use notion databases as the backend for i18n dictionaries.

## Supported formats
* I18next
* Android string xml resource
* C# compatible .resx

## Installation

It can either be installed globally with `npm i -g`, run with `npx`, or installed in a npm project using the package manager of your choice.

Using `npm` (recommended as a dev dependency):
```shell
npm i -d notion-translations
```

# How to use

Get a notion api key by navigating to [my integrations](https://www.notion.so/my-integrations) and create a new integration.

Then navigate to `capabilities` and adjust the permissions given to the extension. The following permissions are required to use specific commands of this tool (if a command is not listed, it does not talk with the notion api):

action | Read | Write | Insert
| - | - | - | - |
| local add | [x] | [ ] | [ ] |
| local sync | [x] | [ ] | [ ] |
| remote new | [x] | [ ] | [x] |
| remote normalize | [x] | [x] | [x] |
| remote import | [x] | [x] | [x] |
| gen | [x] | [ ] | [ ] |

Copy the integration API key and pass it into the tool as the environment variable `NOTION_TOKEN` (supports dotenv, so you can save the api key in a .env file).

## Setup

Run the `translations init` to create a new `notion-translate.json` (change the output directory with `--out <directory>`).

Add the desired databases with `translations local add`.

### Import (optional)

You can import existing translation files into your notion databases using `translations remote import [options]`

## Generate translation files

After you have added the desired databases to the local config, and created the desired translations in notion, you can fetch the databases and generate files of the desired format, run `translations gen [options]`

# Database layout

This script makes a few assumptions about the layout of the notion databases.

* The title column is expected to be called `key`, but this is not required.
* All non-`text` columns will be ignored by the script (though I would like to make it possible to add filters in the future).
* There will be generated a language file for each `text` column in the databases (the databases will be merged into one file per unique column), where the name of the column will be used as the generated "language".
  - Would like to be able to exclude specific columns in the future.

# Roadmap

A few things I would like to add
* Configure the output file name (it's currently only possible to set the output directory).
* Set a filter based on columns of each database.
  - This could fx. be used to ignore specific `text` columns or ignore rows with a checkbox set.
* Add a new language to all databases associated with script.
