# JS Validator

**Laravel-style validation, in the browser, with zero dependencies.**

If you already know Laravel's validation rules, you already know this library. Same rule syntax, same mental model — running client-side, with no framework and nothing to install alongside it.

```js
import Validator from 'innoboxrr-js-validator';

const v = new Validator(form, {
  email:    'required|email',
  password: 'required|min:8|confirmed',
  age:      'required|numeric|between:18,99',
});

if (v.fails()) {
  console.log(v.errors());
}
```

---

## Why

Duplicating validation rules between the backend and the frontend is where bugs hide — the two drift, and users get rejected by the server for something the form said was fine.

Keeping one rule syntax across both sides means the rules stay readable as a pair, and a rule copied from a Laravel FormRequest works unchanged in the browser.

| | |
|---|---|
| **Zero dependencies** | No framework, no build step required. Drop it in. |
| **Familiar syntax** | `required`, `email`, `min`, `max`, `between`, `confirmed`, `regex`, and more. |
| **Custom rules** | Register your own with a function and a message. |
| **Localised messages** | Override any message; ships ready for multi-language forms. |

---

## Install

```bash
npm install innoboxrr-js-validator
```

Or include the bundle directly and use the global `Validator`.

---

## Built by

[Innobox R&R](https://github.com/innoboxrr) — extracted from production forms. Part of a catalogue of 52 open-source packages on Packagist and npm.

**[innobox.systems](https://innobox.systems)**
