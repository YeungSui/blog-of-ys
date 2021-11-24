# springboot下kafka自动创建多个topic

## 首先在application.yml中添加：
```
kafka:
    topics:
        -
            name: topicA
            partition: 1
            replica: 1
        -
            name: topicB
            partition: 1
            replica: 1
```
配置说明：
1.以上配置项是自定义的，非spring自带。
2.配置内容是一个topic列表，里面包含了两个topic的信息，一个topic名为topicA，一个为topicB，分区数都是1，复制主机数都是1

## 然后在项目中创建一个KafkaProperties
```
public class KafkaProperties {
    private List<TopicInfo> topics;

    public List<TopicInfo> getTopics() {
        return topics;
    }
    public void setTopics(List<TopicInfo> topics) {
        this.topics = topics;
    }

    public static class TopicInfo{
        private String name;
        private Integer partition;
        private Integer replication;

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public Integer getPartition() {
            return partition;
        }

        public void setPartition(Integer partition) {
            this.partition = partition;
        }

        public Integer getReplication() {
            return replication;
        }

        public void setReplication(Integer replication) {
            this.replication = replication;
        }
    }
}
```
## 创建一个MqConfiguration类
```
@Configuration
public class MqConfiguration implements BeanDefinitionRegistryPostProcessor, EnvironmentAware {
    private Environment env;

    @Override
    public void postProcessBeanDefinitionRegistry(BeanDefinitionRegistry beanDefinitionRegistry) throws BeansException {
        if (env != null) {
            BindResult<KafkaProperties> result = Binder.get(env).bind("kafka", KafkaProperties.class);
            if (result != null) {
                KafkaProperties props = result.get();
                if (props != null) {
                    for (KafkaProperties.TopicInfo topic : props.getTopics()) {
                        NewTopic nTopic = TopicBuilder.name(topic.getName()).partitions(topic.getPartition()).replicas(topic.getReplication()).build();
                        GenericBeanDefinition bd = new GenericBeanDefinition();
                        bd.setBeanClass(NewTopic.class);
                        bd.setInstanceSupplier(() -> nTopic);
                        beanDefinitionRegistry.registerBeanDefinition(getTopicBeanName(topic.getName()), bd);
                    }
                }
            }
        }
    }

    public static String getTopicBeanName(String name) {
        return "kafka_topic_" + name;
    }

    @Override
    public void postProcessBeanFactory(ConfigurableListableBeanFactory configurableListableBeanFactory) throws BeansException {

    }

    @Override
    public void setEnvironment(Environment environment) {
        env = environment;
    }
}
```
## 大功告成

到此是否一脸懵逼
好吧，其实我也一脸懵逼，我不知道springboot启动时如何配置kafka的adminclient，然后就莫名其妙可以找出所有NewTopic类的bean，然后就可以增量注册到server（实际是zookeeper）上
不过我能解释如何通过以上代码将配置文件中的topic列表装载到spring容器中
1.MqConfiguration是一个BeanFactoryPostProcessor，所以它能在其他常规bean初始化之前初始化，因此可以在这个时候注册一些奇怪的bean，之后spring就会自动帮我们创建这些bean实例并放入容器中
2.MqConfiguration是一个EnvironmentAware，可以获取spring的环境信息（系统变量、配置信息等），获取的时机是在该类被实例化以后
3.借助Binder那一串方法调用可以把配置信息里kafka.*的配置项设置到KafkaProperties，然后就能遍历配置中的topic列表
4.注册bean其实就是将一个beandefinition添加到BeanDefinitionRegistry中,这里创建一个GenericBeanDefinition，并设置bean的实例，spring后续创建时直接使用设置好的instance

为什么搞这么复杂：
1.不想手动建adminclient，既然springboot这么方便，那就物尽其用
2.BeanFactorypostProcessor没法用EnableConfigurationProperties注入
3.创建一个List<NewTopic>的bean并不会触发springboot自动创建topic的逻辑
4.applicationcontext初始化完成后再添加，这时候我不确定还能否触发自动创建topic的逻辑