#!/bin/sh
# See https://docs.mongodb.com/manual/tutorial/install-mongodb-on-ubuntu/

sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv 2930ADAE8CAF5059EE73BB4B58712A2291FA4AD5

# See https://serverfault.com/questions/746348/mongodb-install-fails-in-ubuntu-14-04-docker-container
echo "deb [ arch=amd64 ] http://downloads-distro.mongodb.org/repo/debian-sysvinit dist 10gen" | sudo tee /etc/apt/sources.list.d/mongodb-org-3.6.list

# See https://askubuntu.com/questions/104160/method-driver-usr-lib-apt-methods-https-could-not-be-found-update-error
sudo apt-get install apt-transport-https

sudo apt-get update

sudo apt-get install -y mongodb-org
