#!/bin/bash

# Allow testing to treat the mongo container as if on localhost
sysctl -w net.ipv4.conf.eth0.route_localnet=1
iptables -t nat -A OUTPUT -o lo -p tcp -m tcp --dport 27017 -j DNAT --to-destination `dig +short mongodb`:27017
iptables -t nat -A POSTROUTING -o eth0 -m addrtype --src-type LOCAL --dst-type UNICAST -j MASQUERADE
