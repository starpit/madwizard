# Exports

## Export an env var

```shell
export FOO=3
```

```shell
export FOO=2:$FOO
```

## Then use it

```shell
echo "This should be 2:3 --> $FOO"
```

## Propagation check

This should be valid, if FOO is propagated correctly to the validator.

```shell
---
validate: "[ \"$FOO\" = \"2:3\" ]"
---
echo "Bug if we get here"
```