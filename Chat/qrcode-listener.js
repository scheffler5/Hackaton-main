// qrcode-listener.js (no seu computador local)
const { PubSub } = require('@google-cloud/pubsub');
const qrcode = require('qrcode-terminal'); // Certifique-se de ter 'qrcode-terminal' instalado
const pubSubClient = new PubSub();

const subscriptionName = 'fozzi-qr-code-topic-sub'; // Seu nome de assinatura correto
const topicName = 'fozzi-qrcode-topic'; // Seu nome de tópico correto

async function setupSubscriptionListener() {
    console.log(`Attempting to set up listener for subscription: ${subscriptionName} on topic: ${topicName}`);

    // Obtenha a referência ao tópico
    const topic = pubSubClient.topic(topicName);
    // Obtenha a referência à assinatura
    const subscription = topic.subscription(subscriptionName);

    // Verifique se a assinatura existe e crie-a se não existir.
    // Isso é importante para evitar o erro "Resource not found" novamente.
    try {
        const [exists] = await subscription.exists();
        if (!exists) {
            console.log(`Subscription ${subscriptionName} does not exist. Creating it now...`);
            await topic.createSubscription(subscriptionName);
            console.log(`Subscription ${subscriptionName} created successfully.`);
        } else {
            console.log(`Subscription ${subscriptionName} already exists.`);
        }
    } catch (error) {
        console.error(`Error checking/creating subscription ${subscriptionName}:`, error);
        // Em caso de erro sério (ex: permissões), você pode querer sair
        process.exit(1);
    }

    // Criar o manipulador de mensagens
    const messageHandler = message => {
        console.log(`--- QR Code Message Received! (ID: ${message.id}) ---`);
        const qrCodeString = message.data.toString();
        console.log(`QR Code Data (raw string): ${qrCodeString}`);

        // Tenta gerar e exibir o QR code no terminal
        try {
            qrcode.generate(qrCodeString, { small: true });
            console.log('\n--- Scan this QR Code with your WhatsApp app (Settings > Linked Devices)! ---\n');
        } catch (e) {
            console.error('Error displaying QR Code in terminal. Please scan the raw string above.', e);
        }

        // Confirma a mensagem para que ela não seja reentregue
        message.ack();
        console.log('Message Acknowledged.');
    };

    // Assinar eventos de mensagem e erro
    subscription.on('message', messageHandler);
    subscription.on('error', error => {
        console.error('Error from Pub/Sub subscription:', error);
        // Você pode decidir sair ou tentar reconectar em caso de erro.
    });

    console.log(`\nListening for QR Code messages on subscription: ${subscriptionName}...`);
    console.log('Waiting for the Fozzi bot to publish a QR Code...');

    // Opcional: para parar de escutar depois de um tempo
    // setTimeout(() => {
    //   subscription.removeListener('message', messageHandler);
    //   console.log('Stopped listening after timeout.');
    //   // Certifique-se de fechar o cliente Pub/Sub se for sair
    //   pubSubClient.close();
    //   process.exit(0);
    // }, 60 * 1000); // Para depois de 60 segundos
}

// Chamar a função principal para iniciar o processo
setupSubscriptionListener().catch(console.error);