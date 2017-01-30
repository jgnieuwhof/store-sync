<?php

$key = "PUT YOUR API KEY HERE";
$secret = "PUT YOUR API SECRET HERE";

$oauth = new OAuth($key, $secret);
$oauth->setRequestEngine(OAUTH_REQENGINE_CURL);
$req_token = $oauth->getRequestToken("https://openapi.etsy.com/v2/oauth/request_token?scope=listings_w%20listings_r", 'oob');
$url = $req_token['login_url'];

print "\nGo here: $url\n";

print "Enter verifier:\n";
$handle = fopen("php://stdin","r");
$line = fgets($handle);
fclose($handle);

$verifier = trim($line);
$r_tok = $req_token['oauth_token'];
$r_sec = $req_token['oauth_token_secret'];

print "Verifier: $verifier, rTok: $r_tok, rSec: $r_sec\n";

$oauth->setToken($r_tok, $r_sec);
$acc_token = $oauth->getAccessToken("https://openapi.etsy.com/v2/oauth/access_token", null, $verifier);

var_dump($acc_token);
?>
