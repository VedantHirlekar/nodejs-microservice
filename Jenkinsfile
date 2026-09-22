
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
