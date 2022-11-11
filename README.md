# Create a .env file.

```shell
$  cp .env.dev .env
```
# Building Docker image

```shell
$ docker build -t melda-kernel-manager .
```

# Running with Docker

```shell
$ docker run -d -p 3001:3001 melda-kernel-manager
```

The Que GUI can be accesed from the exposed "3001" port. 
