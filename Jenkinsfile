pipeline {
    agent any

    environment {
        AWS_REGION = 'eu-north-1'
        AWS_ACCOUNT_ID = '206003749282'
        ECR_REGISTRY = "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
        IMAGE_TAG = "v${BUILD_NUMBER}"
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Check Tools') {
            steps {
                sh '''
                    whoami
                    docker --version
                    aws --version
                '''
            }
        }

        stage('ECR Login') {
            steps {
                sh '''
                    aws ecr get-login-password --region ${AWS_REGION} | \
                    docker login \
                    --username AWS \
                    --password-stdin ${ECR_REGISTRY}
                '''
            }
        }

        stage('Build Images') {
            steps {
                sh '''
                    docker build -t ${ECR_REGISTRY}/user-service:${IMAGE_TAG} ./user-service

                    docker build -t ${ECR_REGISTRY}/product-service:${IMAGE_TAG} ./product-service

                    docker build -t ${ECR_REGISTRY}/order-service:${IMAGE_TAG} ./order-service

                    docker build -t ${ECR_REGISTRY}/payment-service:${IMAGE_TAG} ./payment-service

                    docker build -t ${ECR_REGISTRY}/notification-service:${IMAGE_TAG} ./notification-service
                '''
            }
        }

        stage('Push Images') {
            steps {
                sh '''
                    docker push ${ECR_REGISTRY}/user-service:${IMAGE_TAG}

                    docker push ${ECR_REGISTRY}/product-service:${IMAGE_TAG}

                    docker push ${ECR_REGISTRY}/order-service:${IMAGE_TAG}

                    docker push ${ECR_REGISTRY}/payment-service:${IMAGE_TAG}

                    docker push ${ECR_REGISTRY}/notification-service:${IMAGE_TAG}
                '''
            }
        }

        stage('Deploy user-service') {
            steps {
                script {

                    def commandId = sh(
                        script: """
                            aws ssm send-command \
                            --region ${AWS_REGION} \
                            --instance-ids i-0609f3bfe8e4522cd \
                            --document-name AWS-RunShellScript \
                            --parameters 'commands=[
                                "cd /home/ssm-user/nodejs-microservice",
                                "PREVIOUS_TAG=\\$(grep -A1 \\"^  user-service:\\" docker-compose.yml | grep image | sed \\"s/.*user-service:\\(.*\\)/\\\\1/\\")",
                                "echo Previous version: \\$PREVIOUS_TAG",
                                "aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_REGISTRY}",
                                "docker pull ${ECR_REGISTRY}/user-service:${IMAGE_TAG}",
                                "sed -i \\"/^[[:space:]]*user-service:/,/^[[:space:]]*[a-zA-Z].*:/ s#user-service:v[0-9]*#user-service:${IMAGE_TAG}#\\" docker-compose.yml",
                                "docker compose up -d user-service",
                                "sleep 10",
                                "if curl -fsS http://localhost/users/health; then echo Health check PASSED; else sed -i \\"/^[[:space:]]*user-service:/,/^[[:space:]]*[a-zA-Z].*:/ s#user-service:${IMAGE_TAG}#user-service:\\$PREVIOUS_TAG#\\" docker-compose.yml; docker compose up -d user-service; echo Rollback completed; exit 1; fi"
                            ]' \
                            --query 'Command.CommandId' \
                            --output text
                        """,
                        returnStdout: true
                    ).trim()

                    echo "SSM Command ID: ${commandId}"

                    sh """
                        aws ssm wait command-executed \
                        --region ${AWS_REGION} \
                        --command-id ${commandId} \
                        --instance-id i-0609f3bfe8e4522cd
                    """

                    sh """
                        aws ssm get-command-invocation \
                        --region ${AWS_REGION} \
                        --command-id ${commandId} \
                        --instance-id i-0609f3bfe8e4522cd \
                        --query 'StandardOutputContent' \
                        --output text
                    """
                }
            }
        }
    }

    post {
        success {
            echo "All 5 images pushed successfully with tag ${IMAGE_TAG}"
        }

        failure {
            echo "Pipeline failed. Check the stage that failed."
        }

        always {
            sh '''
                docker image prune -f
            '''
        }
    }
}