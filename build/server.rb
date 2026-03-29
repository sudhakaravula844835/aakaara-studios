require 'webrick'

root = File.expand_path(File.dirname(__FILE__))
server = WEBrick::HTTPServer.new(
  Port: 8080,
  DocumentRoot: root,
  Logger: WEBrick::Log.new($stdout, WEBrick::Log::INFO),
  AccessLog: []
)

trap('INT') { server.shutdown }
trap('TERM') { server.shutdown }

server.start
