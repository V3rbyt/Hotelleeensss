import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidCpf, isValidCnpj, isEmail, passwordStrength, parseJsonArray } from "../server/utils/validators.js";

test("CPF válido e inválido", () => {
  assert.equal(isValidCpf("529.982.247-25"), true);
  assert.equal(isValidCpf("111.111.111-11"), false);
  assert.equal(isValidCpf("123"), false);
});

test("CNPJ válido e inválido", () => {
  assert.equal(isValidCnpj("11.222.333/0001-81"), true);
  assert.equal(isValidCnpj("00.000.000/0000-00"), false);
});

test("e-mail e senha", () => {
  assert.equal(isEmail("a@b.com"), true);
  assert.equal(isEmail("x"), false);
  assert.equal(passwordStrength("short"), "A senha deve ter pelo menos 8 caracteres.");
  assert.equal(passwordStrength("semnumero"), "A senha deve combinar letras e números.");
  assert.equal(passwordStrength("Senha1234"), null);
});

test("listas", () => {
  assert.deepEqual(parseJsonArray("Português, Inglês"), ["Português", "Inglês"]);
});
