prod:
	emcmake cmake ../wasmd_cpp -B../wasmd_cpp/build -DCMAKE_BUILD_TYPE=Release
	cmake --build ../wasmd_cpp/build
	npm run prod --prefix ../wasmd_web
	npm run prod
	docker build -t silentraccoon02/wasmd .
	docker push silentraccoon02/wasmd:latest

run:
	docker run -d -p 2512:2512 --rm --name wasmd silentraccoon02/wasmd
