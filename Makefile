prod:
	emcmake cmake ../wasmd_guetzli -B../wasmd_guetzli/build -DCMAKE_BUILD_TYPE=Release
	cmake --build ../wasmd_guetzli/build
	npm run prod --prefix ../wasmd_web
	npm run prod
	docker build -t silentraccoon02/wasmd .
	docker push silentraccoon02/wasmd:latest

run:
	docker run -d -p 3000:3000 --rm --name wasmd silentraccoon02/wasmd
