# helidon 入门
## 准备工作
1. **JDK**  
这里选择了 graalvm-ce-21.0.2。虽然已有 24 版本的 graalvm，但是 native-image 始终无法编译 helidon 项目，一直提示添加命令参数 `--initialize-at-build-time=io.helidon.service.registry.ServiceRegistry__ServiceDescriptor$???`，没有记录下 `???`。不过，对于 helidon 4 来说 jdk 21 已经足够了。

## 代码
项目结构如下
```text
/home/malen/IdeaProjects/helidon-example/
├── pom.xml
└── src
    ├── main
    │   ├── java
    │   │   └── com
    │   │       └── malen
    │   │           └── hypatia
    │   │               └── helidon
    │   │                   ├── Demo.java
    │   │                   └── service
    │   │                       └── GreetService.java
    │   └── resources
    │       ├── application.yaml
    │       ├── logback.xml
    │       └── META-INF
    │           └── com
    │               └── malen
    │                   └── hypatia
    │                       └── helidon
    │                           └── native-image.properties
    └── test
        ├── java
        └── resources
```

1. maven 项目
    ```xml
    <?xml version="1.0" encoding="UTF-8" ?>
    <project xmlns="http://maven.apache.org/POM/4.0.0"
            xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
        <modelVersion>4.0.0</modelVersion>

        <artifactId>hypatia-helidon</artifactId>
        <groupId>com.malen</groupId>
        <version>0.1</version>

        <properties>
            <mainClass>com.malen.hypatia.helidon.Demo</mainClass>
        </properties>

        <profiles>
            <profile>
                <id>native-image</id>
                <build>
                    <plugins>
                        <plugin>
                            <groupId>org.graalvm.buildtools</groupId>
                            <artifactId>native-maven-plugin</artifactId>
                            <executions>
                                <execution>
                                    <id>resource-config</id>
                                    <goals>
                                        <goal>generateResourceConfig</goal>
                                    </goals>
                                </execution>
                                <execution>
                                    <id>build-native-image</id>
                                    <goals>
                                        <goal>compile-no-fork</goal>
                                    </goals>
                                </execution>
                            </executions>
                        </plugin>
                    </plugins>
                </build>
            </profile>
        </profiles>

        <dependencies>
            <dependency>
                <groupId>org.junit.jupiter</groupId>
                <artifactId>junit-jupiter</artifactId>
                <version>5.9.3</version>
                <scope>test</scope>
            </dependency>
            <dependency>
                <groupId>io.helidon.integrations.graal</groupId>
                <artifactId>helidon-graal-native-image-extension</artifactId>
            </dependency>
            <dependency>
                <groupId>io.helidon.webserver</groupId>
                <artifactId>helidon-webserver</artifactId>
            </dependency>
            <dependency>
                <groupId>io.helidon.common</groupId>
                <artifactId>helidon-common-config</artifactId>
            </dependency>
            <dependency>
                <groupId>io.helidon.config</groupId>
                <artifactId>helidon-config-yaml</artifactId>
            </dependency>
            <dependency>
                <groupId>io.helidon.http.media</groupId>
                <artifactId>helidon-http-media-jackson</artifactId>
            </dependency>
            <dependency>
                <groupId>io.helidon.logging</groupId>
                <artifactId>helidon-logging-slf4j</artifactId>
            </dependency>
            <dependency>
                <groupId>ch.qos.logback</groupId>
                <artifactId>logback-classic</artifactId>
                <version>1.5.13</version>
            </dependency>
            <dependency>
                <groupId>ch.qos.logback</groupId>
                <artifactId>logback-core</artifactId>
                <version>1.5.13</version>
            </dependency>
        </dependencies>

        <dependencyManagement>
            <dependencies>
                <dependency>
                    <groupId>io.helidon</groupId>
                    <artifactId>helidon-bom</artifactId>
                    <version>4.2.0</version>
                    <type>pom</type>
                    <scope>import</scope>
                </dependency>
            </dependencies>
        </dependencyManagement>

        <build>
            <plugins>
                <plugin>
                    <groupId>org.apache.maven.plugins</groupId>
                    <artifactId>maven-compiler-plugin</artifactId>
                    <version>3.14.0</version>
                    <configuration>
                        <source>21</source>
                        <target>21</target>
                    </configuration>
                </plugin>
            </plugins>
        </build>
    </project>
    ```

    - profile: native-image，预留给 native image 打包的配置，多了一个 `native-maven-plugin` 插件
    - property: mainClass，预留给 native image 插件的变量，插件读取该配置确定 main 方法
    - dependencies，大多是 helidon 的依赖，由于在 management 中引入了 helidon-bom，设计 helidon 的依赖不需要带上 version
    - profiles 及 dependencyManagement 可以使用 helidon parent 完成配置，这里拆出来只是为了了解 helidon 基本组件的关系
2. 入口
    ```java
    package com.malen.hypatia.helidon;

    import com.malen.hypatia.helidon.service.GreetService;
    import io.helidon.common.config.Config;
    import io.helidon.logging.common.LogConfig;
    import io.helidon.service.registry.Services;
    import io.helidon.webserver.WebServer;
    import io.helidon.webserver.http.HttpRouting;
    import org.slf4j.Logger;
    import org.slf4j.LoggerFactory;


    public class Demo {
        private static final Logger log = LoggerFactory.getLogger(Demo.class);

        public static void main(String[] args) {
            LogConfig.configureRuntime();
            // many examples, including the demo generated by helidon, use deprecated method [io.helidon.config.Config#global(io.helidon.config.Config)]
            Services.set(Config.class, Config.create());

            WebServer server = WebServer.builder()
                    .config(Services.get(Config.class).get("server"))
                    .routing(Demo::route)
                    .build()
                    .start();

            log.info("Server started on port {}", server.port());
        }

        private static void route(HttpRouting.Builder builder) {
            builder.register("/greeting", new GreetService());
        }
    }
    ```
    - ``configureRuntime`` 不确定在干嘛，只和 native runtime 有关，官方 demo 有就保留下来了。
    - ``Services.set`` 这里和官方 demo 的 ``io.helidon.config.Config.global(io.helidon.config.Config.create())`` 不一样，因为官方 demo 的方法已经标记为 deprecated 了，建议使用 ``Services.set`` 替代。这段代码只是将 config 实例变成一个全局变量，后续有其他地方要读取配置信息可以直接取同一个实例而不必再初始化，比如后面的 `Services.get(Config.class)`
    - `config` 实例包含了 application.yml 的配置信息，`Services.get(Config.class).get("server")` 对应 ``application.yml`` 配置文件中的 server 对象
        ```yaml
        {
            "server": {
                "port": 8080
            }
        }
        ```
    - 路由  
    官方给出多种路由形式，比如最简单的 `builder.get("/", (req, res) -> res.send("ok"));` ，而当前示例则是使用 `HttpService` 接口以拆分下级路由规则，避免所有路由都堆在一个地方。
        ```java
        package com.malen.hypatia.helidon.service;

        import io.helidon.webserver.http.HttpRules;
        import io.helidon.webserver.http.HttpService;

        public class GreetService implements HttpService {
            @Override
            public void routing(HttpRules httpRules) {
                httpRules.get("/", (req, res) -> res.send("Hello World!\n"));
            }
        }

        ```

## 打包
1. 可以打为普通 jar，这里就不具体说明了
2. 主要说 native image，但其实也没什么好说的
    ```sh
    export GRAALVM_HOME=/path/to/your/graalvm-jdk
    export JAVA_HOME=/path/to/your/openjdk
    mvn package -Pnative-image
    /path/to/your/project-base/target/hypatia-helidon
    ```
    - `JAVA_HOME` 是给 maven 用的，这里建议用普通的 21 版本的 openjdk，比如 eclipse 或者 corretto，至少我用 24 的 graalvm jdk 执行 maven 遇到一些问题
    - `GRAALVM_HOME` 是给 native-maven-plugin 使用的，这个插件会优先使用 `GRAALVM_HOME` 环境变量获取 native-image 可执行文件，其次使用 `JAVA_HOME`。
    - 指定 profile 为 `native-image`